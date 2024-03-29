# Check for Chocolatey and install it if it's not present
try {
    $chocoPath = Get-Command choco -ErrorAction Stop
    Write-Host "Chocolatey is already installed."
} catch {
    Write-Host "Chocolatey not found, installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
    Write-Host "Chocolatey installation complete."
}

# Continue with the mkcert installation and setup
try {
    $mkcertPath = Get-Command mkcert -ErrorAction Stop
    Write-Host "mkcert is already installed at: $mkcertPath"
} catch {
    Write-Host "mkcert not found, attempting installation using Chocolatey..."

    try {
        choco install mkcert -y
        Write-Host "mkcert installation successful."
    } catch {
        Write-Error "Failed to install mkcert using Chocolatey: $_"
        Read-Host -Prompt "Press Enter to exit"
        exit
    }
}

try {
    mkcert -install
    mkcert localhost 127.0.0.1 ::1
    Write-Host "mkcert CA setup completed successfully."
} catch {
    Write-Error "Failed to run 'mkcert -install': $_"
}

Read-Host -Prompt "Press Enter to exit"