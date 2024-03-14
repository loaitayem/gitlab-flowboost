const fs = require('fs');
const path = require('path');

const configSchema = {
    mergeRequestOptions: {
      branches: { required: true, useDefault: false }, // Must be provided by user
      // Other mergeRequestOptions properties...
    },
    branchesOptions: {
      // defaultBranchNamingConvention: { value: "feature/**", required: true, useDefault: true }, // Can use default
      // regexNamingValidation: { value: undefined, required: false }, // Optional
      // Other branchesOptions properties...
    },
    // Other top-level configuration options...
};

// Dynamic handling for test mode
function handleTestMode(mergedConfig, baseConfig) {
    // Implement your test mode-specific logic here
    // For now, it simply uses the default configuration
    return baseConfig;
    // You can easily adjust this function later to change the test mode behavior
}

  function mergeAndValidateConfig(schema, userConfig, path = '') {
    let finalConfig = {};
    let missingRequiredKeys = [];
  
    for (const key in schema) {
      if (!schema.hasOwnProperty(key)) continue;
  
      const currentPath = path ? `${path}.${key}` : key;
      const schemaItem = schema[key];
      const isRequired = schemaItem.required;
      const canUseDefault = schemaItem.hasOwnProperty('useDefault') ? schemaItem.useDefault : false;
      const defaultValue = schemaItem.hasOwnProperty('value') ? schemaItem.value : null;
  
      if (typeof schemaItem === 'object' && schemaItem !== null && !('value' in schemaItem)) {
        // If the property is an object, recurse
        const { config, missing } = mergeAndValidateConfig(schemaItem, userConfig[key] || {}, currentPath);
        finalConfig[key] = config;
        missingRequiredKeys = missingRequiredKeys.concat(missing);
      } else if (userConfig.hasOwnProperty(key)) {
        // Use the user's value if provided
        finalConfig[key] = userConfig[key];
      } else if (isRequired && !canUseDefault) {
        // Required property missing and cannot use default
        missingRequiredKeys.push(currentPath);
      } else {
        // Use default value if available, otherwise set to undefined
        finalConfig[key] = canUseDefault ? defaultValue : undefined;
      }
    }
  
    // If there are any missing required configurations, throw an error
    if (missingRequiredKeys.length > 0) {
      throw new Error(`Missing required configurations: ${missingRequiredKeys.join(', ')}. Please update your configuration file.`);
    }
  
    return { config: finalConfig, missing: missingRequiredKeys };
  }

// Reads and parses the configuration file. Tries to load a user-specific config, 
// falling back to a default config if the user-specific one isn't found.
function readConfig() {
    const defaultConfigPath = path.join(__dirname, 'default-config.json');
    const userConfigPath = path.join(process.cwd(), 'flowboost-config.json');
  
    let baseConfig = {};
  
    // Load the default config as a baseline
    if (fs.existsSync(defaultConfigPath)) {
      const defaultConfigContent = fs.readFileSync(defaultConfigPath, 'utf8');
      baseConfig = JSON.parse(defaultConfigContent);
    }
  
    let userConfig = {};
    // Override with user's custom config if available
    if (fs.existsSync(userConfigPath)) {
      const userConfigContent = fs.readFileSync(userConfigPath, 'utf8');
      userConfig = JSON.parse(userConfigContent) || {};
    }
  
    // Merge userConfig into the base config, overriding any matching properties
    const mergedConfig = { ...baseConfig, ...userConfig };
  
    // Check the mode specified in the merged configuration
    if (mergedConfig.mode === 'dev') {
      // Apply test-specific configurations or logic
      return handleTestMode(mergedConfig, baseConfig);
      // For example, you might want to override certain properties for testing
    }
  
    // Validate the final merged config
    try {
      const finalConfig = mergeAndValidateConfig(configSchema, mergedConfig); // Assumes mergeAndValidateConfig returns the final config directly
      return finalConfig;
    } catch (error) {
      console.error(`Configuration Error: ${error.message}`);
      throw error; // Halt execution by re-throwing the error
    }
  }

const config = readConfig();

function getLabelsPushOptionFromConfig(branchName) {
    const branchConfig = config.mergeRequestOptions.branches.find(branch => branch.name === branchName);
  
    if (!branchConfig) {
      console.error(`Branch "${branchName}" is not defined in the configuration.`);
      return '';
    }
  
    const requiredLabels = branchConfig.requiredLabels;
    const labelsOptions = requiredLabels.map(label => `-o merge_request.label="${label}"`).join(' ');
  
    return labelsOptions;
}

// Accepts a list of keys representing the path to the feature within the config object
function getFeature(...keys) {
    const config = readConfig();

    try {
        // Reduce the keys to navigate through the nested config object
        const featureValue = keys.reduce((currentConfig, key) => {
            if (currentConfig && typeof currentConfig === 'object') {
                return currentConfig[key];
            }
            throw new Error(`Invalid configuration path: ${keys.join(' -> ')}`);
        }, config);

        // Return the boolean value of the feature flag
        return featureValue;
    } catch (error) {
        console.error(`Error checking feature enabled status: ${error.message}`);
        return false;
    }
}

function getBranchSettings(branchName = undefined) {
    const branches = config.mergeRequestOptions.branches;

    if (branchName) {
      return branches.find(env => env.name === branchName) || undefined;
    }

    return branches.map(branch => ({
      name: branch.name,
      isDraftPR: branch.isDraftPR
    }));
}

function shouldDeleteBranch() {
  return getFeature('mergeRequestOptions', 'setToDeleteBranchAfterMainMerge');
}

function allowToCreateTempBranches() {
  return getFeature('mergeRequestOptions', 'allowToCreateTempBranches');
}

function isDraft(branchName) {
  return getBranchSettings(branchName).isDraftPR;
}

function getMainBranch(isMergeRequest = true) {
  if (isMergeRequest) {
    return getFeature('mergeRequestOptions', 'mainBranch');
  } else {
    // TODO handle different scenarios ex: branch creation
  }
}

module.exports = {
    readConfig,
    getLabelsPushOptionFromConfig,
    getFeature,
    getBranchSettings,
    shouldDeleteBranch,
    allowToCreateTempBranches,
    getMainBranch,
    isDraft
};