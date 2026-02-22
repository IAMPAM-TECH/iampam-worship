# Script to upload frontend files to S3 and invalidate CloudFront cache
param(
    [string]$BucketName = "hishalom-frontend",
    [string]$Region = "ap-northeast-2",
    [string]$CloudFrontDistributionId = "E65Q2X6LAYQBD",
    [switch]$InvalidateAll = $false
)

# Handle --InvalidateAll format (PowerShell doesn't support -- prefix by default)
# Check if BucketName was mistakenly set to --InvalidateAll
if ($BucketName -eq "--InvalidateAll") {
    $InvalidateAll = $true
    $BucketName = "hishalom-frontend"
}

# Also check $args for --InvalidateAll in case it's passed as a separate argument
if ($args -contains "--InvalidateAll" -or $args -contains "-InvalidateAll") {
    $InvalidateAll = $true
}

# AWS 자격 증명 설정
$env:AWS_ACCESS_KEY_ID = "AKIA4DHEC72CUJGPCQOR"
$env:AWS_SECRET_ACCESS_KEY = "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"
$env:AWS_REGION = "ap-northeast-2"

Write-Host "Uploading frontend files to S3 bucket and invalidating CloudFront cache..." -ForegroundColor Green
Write-Host "Bucket: $BucketName" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host "CloudFront Distribution ID: $CloudFrontDistributionId" -ForegroundColor Yellow
Write-Host "AWS Region: $env:AWS_REGION" -ForegroundColor Yellow

# Upload all files from frontend-serverless folder to S3 (deploy directly under bucket)
$SourceDir = "frontend-serverless"
$Files = Get-ChildItem -Path $SourceDir -Recurse -File
$UploadedFiles = @()

foreach ($File in $Files) {
    # Remove frontend-serverless folder path to deploy directly under bucket
    $RelativePath = $File.FullName.Substring((Get-Location).Path.Length + 1)
    $S3Key = $RelativePath.Replace("frontend-serverless\", "").Replace("frontend-serverless/", "").Replace("\", "/")
    
    Write-Host "Uploading: $S3Key" -ForegroundColor Cyan
    
    # Set Content-Type based on file type
    $ContentType = switch ($File.Extension.ToLower()) {
        ".html" { "text/html" }
        ".css" { "text/css" }
        ".js" { "application/javascript" }
        ".json" { "application/json" }
        ".png" { "image/png" }
        ".jpg" { "image/jpeg" }
        ".jpeg" { "image/jpeg" }
        ".gif" { "image/gif" }
        ".svg" { "image/svg+xml" }
        ".ico" { "image/x-icon" }
        ".txt" { "text/plain" }
        ".md" { "text/markdown" }
        default { "application/octet-stream" }
    }
    
    # Upload file using AWS CLI
    $UploadCommand = "aws s3 cp `"$($File.FullName)`" s3://$BucketName/$S3Key --content-type `"$ContentType`" --region $Region"
    
    try {
        Invoke-Expression $UploadCommand
        Write-Host "✓ Success: $S3Key" -ForegroundColor Green
        $UploadedFiles += "/$S3Key"
    }
    catch {
        Write-Host "✗ Failed: $S3Key - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nUpload completed!" -ForegroundColor Green

# CloudFront cache invalidation
Write-Host "`nStarting CloudFront cache invalidation..." -ForegroundColor Green

try {
    if ($InvalidateAll) {
        # Invalidate cache for all files (/*)
        Write-Host "Performing full cache invalidation..." -ForegroundColor Yellow
        $InvalidateCommand = "aws cloudfront create-invalidation --distribution-id $CloudFrontDistributionId --paths `"/*`" --region $Region"
        Invoke-Expression $InvalidateCommand
        Write-Host "✓ Full CloudFront cache invalidation requested successfully." -ForegroundColor Green
    }
    else {
        # Invalidate cache for uploaded files only
        Write-Host "Invalidating cache for uploaded files..." -ForegroundColor Yellow
        
        # CloudFront can only invalidate up to 15 paths at once, so process in batches
        $BatchSize = 15
        for ($i = 0; $i -lt $UploadedFiles.Count; $i += $BatchSize) {
            $Batch = $UploadedFiles[$i..([Math]::Min($i + $BatchSize - 1, $UploadedFiles.Count - 1))]
            $Paths = $Batch -join " "
            
            $InvalidateCommand = "aws cloudfront create-invalidation --distribution-id $CloudFrontDistributionId --paths $Paths --region $Region"
            Invoke-Expression $InvalidateCommand
            
            Write-Host "✓ Batch $([Math]::Floor($i / $BatchSize) + 1) cache invalidation completed ($($Batch.Count) files)" -ForegroundColor Green
        }
    }
    
    Write-Host "Cache invalidation typically takes 5-10 minutes." -ForegroundColor Yellow
}
catch {
    Write-Host "✗ CloudFront cache invalidation failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nDeployment completed!" -ForegroundColor Green
Write-Host "S3 Website URL: https://$BucketName.s3.$Region.amazonaws.com/index.html" -ForegroundColor Yellow
Write-Host "CloudFront URL: https://$CloudFrontDistributionId.cloudfront.net" -ForegroundColor Yellow 