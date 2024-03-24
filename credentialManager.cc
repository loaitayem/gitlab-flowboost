#include <string>
#include <napi.h>
#include <windows.h>
#include <wincred.h>

// Helper function to retrieve the password
bool GetPassword(const std::string& service, std::string& username, std::string& password) {
    CREDENTIAL* cred;
    if (CredReadA(service.c_str(), CRED_TYPE_GENERIC, 0, &cred)) {
        username = std::string(cred->UserName);
        password = std::string(reinterpret_cast<char*>(cred->CredentialBlob), cred->CredentialBlobSize);
        CredFree(cred);
        return true;
    }
    return false;
}

// Wrapper function for Node.js
Napi::Value GetPasswordWrapped(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // Check arguments
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string service = info[0].As<Napi::String>().Utf8Value();
    std::string username, password;

    // Call the helper function
    if (GetPassword(service, username, password)) {
        Napi::Object result = Napi::Object::New(env);
        result.Set("username", Napi::String::New(env, username));
        result.Set("password", Napi::String::New(env, password));
        return result;
    } else {
        // If credentials are not found or an error occurred, return undefined
        return env.Undefined();
    }
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "getPassword"), Napi::Function::New(env, GetPasswordWrapped));
    return exports;
}

NODE_API_MODULE(credentialManager, Init)