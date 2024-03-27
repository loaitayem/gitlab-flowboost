{
  "variables": {
    "openssl_fips": "0"
  },
  "targets": [
    {
      "target_name": "credentialManager",
      "sources": [ "./credentialManager.cc" ],
      'include_dirs': ["<!(node -p \"require('node-addon-api').include_dir\")"],
      "defines": [ "NAPI_CPP_EXCEPTIONS", "NAPI_VERSION=<(napi_build_version)" ]
    }
  ]
}