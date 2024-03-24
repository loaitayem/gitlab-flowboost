{
  "targets": [
    {
      "target_name": "credentialManager",
      "sources": [ "./credentialManager.cc" ],
      'include_dirs': ["<!(node -p \"require('node-addon-api').include_dir\")"],
      "defines": [ "NAPI_CPP_EXCEPTIONS" ]
    }
  ]
}