let inquirerCache;

async function loadInquirer() {
  if (!inquirerCache) {
    inquirerCache = import('inquirer').then(module => module.default || module);
  }
  return inquirerCache;
}

module.exports = { loadInquirer };