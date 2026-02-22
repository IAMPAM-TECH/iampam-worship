# 하이샬롬 예배자동화 Serverless Backend 배포 스크립트 (PowerShell)
# 사용법: .\deploy.ps1 [dev|prod]

param(
    [string]$Stage = "dev"
)

# 색상 정의
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"
$White = "White"

# 로그 함수
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

# 스테이지 검증
if ($Stage -ne "dev" -and $Stage -ne "prod") {
    Write-Error "Invalid stage. Use 'dev' or 'prod'."
    exit 1
}

Write-Host "🚀 Hishalom Worship Serverless Backend Deployment Started" -ForegroundColor $Green
Write-Info "Stage: $Stage"

# Node.js 버전 확인 (20.x 필요)
try {
    $NodeVersion = node --version
    $NodeMajorVersion = $NodeVersion.Substring(1, 2) -as [int]
    
    if ($NodeMajorVersion -lt 20) {
        Write-Error "Node.js 20.x or higher required. Current version: $NodeVersion"
        Write-Info "Please upgrade Node.js or use nvm to change version."
        exit 1
    }
    
    Write-Success "Node.js version check completed: $NodeVersion"
}
catch {
    Write-Error "Node.js is not installed."
    exit 1
}

# npm 확인
try {
    $NpmVersion = npm --version
    Write-Info "npm version: $NpmVersion"
}
catch {
    Write-Error "npm is not installed."
    exit 1
}

# 의존성 설치
Write-Info "Installing dependencies..."
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Dependency installation failed"
        exit 1
    }
    Write-Success "Dependencies installed successfully"
}
catch {
    Write-Error "Error occurred during dependency installation"
    exit 1
}

# AWS CLI 확인
try {
    $AwsVersion = aws --version
    Write-Info "AWS CLI version: $AwsVersion"
}
catch {
    Write-Error "AWS CLI is not installed."
    Write-Info "Please install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
}

# AWS 자격 증명 확인
Write-Info "Checking AWS credentials..."
try {
    $CallerIdentity = aws sts get-caller-identity 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "AWS credentials are not configured."
        Write-Info "Please configure AWS credentials using:"
        Write-Info "aws configure"
        exit 1
    }
    
    $AccountId = ($CallerIdentity | ConvertFrom-Json).Account
    $Arn = ($CallerIdentity | ConvertFrom-Json).Arn
    Write-Success "AWS Account: $AccountId"
    Write-Info "AWS User: $Arn"
}
catch {
    Write-Error "Error occurred while checking AWS credentials"
    exit 1
}

# Serverless Framework 확인
try {
    $ServerlessVersion = serverless --version
    Write-Info "Serverless Framework version: $ServerlessVersion"
}
catch {
    Write-Error "Serverless Framework is not installed."
    Write-Info "Please install Serverless Framework using:"
    Write-Info "npm install -g serverless"
    exit 1
}

# 환경 변수 파일 확인
if (-not (Test-Path ".env")) {
    Write-Warning ".env file not found."
    if (Test-Path "env.example") {
        Write-Info "Copying env.example to .env..."
        Copy-Item "env.example" ".env"
        Write-Warning "Please edit .env file with actual values."
    }
    else {
        Write-Warning "env.example file also not found. Please check environment variables."
    }
}

# 배포 전 확인 (기본값: 예)
Write-Info "Starting deployment without interactive confirmation (default: Yes)"

# 배포 실행
Write-Info "Starting Serverless deployment..."
if ($Stage -eq "prod") {
    Write-Warning "Deploying to production environment! Proceeding without interactive confirmation (default: Yes)"
    
    try {
        serverless deploy --stage prod --verbose
    }
    catch {
        Write-Error "Production deployment failed"
        exit 1
    }
}
else {
    try {
        serverless deploy --stage dev --verbose
    }
    catch {
        Write-Error "Development deployment failed"
        exit 1
    }
}

# 배포 결과 확인
if ($LASTEXITCODE -eq 0) {
    Write-Success "Deployment completed successfully!"
    
    # API Gateway URL 출력
    try {
        if ($Stage -eq "prod") {
            $ApiInfo = serverless info --stage prod --verbose
        }
        else {
            $ApiInfo = serverless info --stage dev --verbose
        }
        
        $EndpointLine = $ApiInfo | Select-String "endpoint:"
        if ($EndpointLine) {
            $ApiUrl = $EndpointLine.Line.Split(":")[1].Trim()
            Write-Info "API Gateway URL: $ApiUrl"
            Write-Info "Health Check: $ApiUrl/api/health"
        }
        
        # 프론트엔드 설정 안내
        Write-Info "Please update API URL in frontend:"
        Write-Info "Update API call URLs in frontend/admin.html and frontend/worship.html to $ApiUrl"
        
    }
    catch {
        Write-Warning "Could not retrieve API information."
    }
}
else {
    Write-Error "Deployment failed."
    exit 1
}

Write-Success "All operations completed successfully!" 