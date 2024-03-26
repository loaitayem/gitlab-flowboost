#include <string>
#include <napi.h>
#include <windows.h>
#include <wincred.h>

// Helper function to convert UTF-16 to UTF-8
std::string wideToUtf8(const wchar_t* buffer, DWORD length) {
    int sizeNeeded = WideCharToMultiByte(CP_UTF8, 0, buffer, length, NULL, 0, NULL, NULL);
    std::string utf8Str(sizeNeeded, 0);
    WideCharToMultiByte(CP_UTF8, 0, buffer, length, &utf8Str[0], sizeNeeded, NULL, NULL);
    return utf8Str;
}

// Helper function to retrieve the password
bool GetPassword(const std::string& service, std::string& username, std::string& password) {
    CREDENTIALA* cred;
    if (CredReadA(service.c_str(), CRED_TYPE_GENERIC, 0, &cred)) {
        username = std::string(cred->UserName);

        // Check if the password needs decoding (assuming UTF-16 encoding)
        if (cred->CredentialBlobSize % 2 == 0) {
            password = wideToUtf8(reinterpret_cast<wchar_t*>(cred->CredentialBlob), cred->CredentialBlobSize / 2);
        } else {
            // If the password doesn't appear to be UTF-16 encoded, use it as is
            password = std::string(reinterpret_cast<char*>(cred->CredentialBlob), cred->CredentialBlobSize);
        }

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