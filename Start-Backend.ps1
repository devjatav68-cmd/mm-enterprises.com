param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$DataDir = Join-Path $Root "data"
$ProductsFile = Join-Path $DataDir "products.json"
$OrdersFile = Join-Path $DataDir "orders.json"
$MessagesFile = Join-Path $DataDir "messages.json"

$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".png" = "image/png"
  ".svg" = "image/svg+xml"
  ".ico" = "image/x-icon"
}

function Read-JsonFile($Path, $Fallback) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return $Fallback
  }

  $Text = Get-Content -Raw -LiteralPath $Path
  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $Fallback
  }

  return $Text | ConvertFrom-Json
}

function Write-JsonFile($Path, $Value) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
  $Value | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function To-Array($Value) {
  if ($null -eq $Value) {
    return @()
  }
  if ($Value -is [array]) {
    return $Value
  }
  return @($Value)
}

function Clean-Text($Value, [int]$MaxLength = 120) {
  $Text = ([string]$Value).Trim()
  if ($Text.Length -gt $MaxLength) {
    return $Text.Substring(0, $MaxLength)
  }
  return $Text
}

function New-Response($StatusCode, $ContentType, [byte[]]$BodyBytes) {
  return [pscustomobject]@{
    StatusCode = $StatusCode
    ContentType = $ContentType
    BodyBytes = $BodyBytes
  }
}

function New-JsonResponse($StatusCode, $Payload) {
  $Json = $Payload | ConvertTo-Json -Depth 10
  $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Json)
  return New-Response $StatusCode "application/json; charset=utf-8" $Bytes
}

function Read-HttpRequest($Stream) {
  $Reader = New-Object System.IO.StreamReader($Stream, [System.Text.Encoding]::UTF8, $false, 1024, $true)
  $FirstLine = $Reader.ReadLine()
  if ([string]::IsNullOrWhiteSpace($FirstLine)) {
    return $null
  }

  $Parts = $FirstLine.Split(" ")
  $Headers = @{}

  while ($true) {
    $Line = $Reader.ReadLine()
    if ($null -eq $Line -or $Line -eq "") {
      break
    }

    $Index = $Line.IndexOf(":")
    if ($Index -gt 0) {
      $Headers[$Line.Substring(0, $Index).Trim()] = $Line.Substring($Index + 1).Trim()
    }
  }

  $Body = ""
  if ($Headers.ContainsKey("Content-Length")) {
    $Length = [int]$Headers["Content-Length"]
    if ($Length -gt 0) {
      $Buffer = New-Object char[] $Length
      $Read = $Reader.Read($Buffer, 0, $Length)
      $Body = -join $Buffer[0..($Read - 1)]
    }
  }

  return [pscustomobject]@{
    Method = $Parts[0]
    Target = $Parts[1]
    Headers = $Headers
    Body = $Body
  }
}

function Get-QueryParams($QueryString) {
  $Params = @{}
  if ([string]::IsNullOrWhiteSpace($QueryString)) {
    return $Params
  }

  foreach ($Pair in $QueryString.TrimStart("?").Split("&")) {
    if ([string]::IsNullOrWhiteSpace($Pair)) {
      continue
    }

    $Pieces = $Pair.Split("=", 2)
    $Name = [uri]::UnescapeDataString($Pieces[0])
    $Value = if ($Pieces.Count -gt 1) { [uri]::UnescapeDataString($Pieces[1].Replace("+", " ")) } else { "" }
    $Params[$Name] = $Value
  }

  return $Params
}

function Get-ProductIdFromReferer($Request) {
  if (-not $Request.Headers.ContainsKey("Referer")) {
    return ""
  }

  try {
    $Uri = [uri]$Request.Headers["Referer"]
    return [System.IO.Path]::GetFileNameWithoutExtension($Uri.AbsolutePath)
  } catch {
    return ""
  }
}

function Read-BodyJson($Request) {
  if ([string]::IsNullOrWhiteSpace($Request.Body)) {
    return [pscustomobject]@{}
  }

  return $Request.Body | ConvertFrom-Json
}

function Handle-Api($Request, $Path, $Query) {
  $Products = To-Array (Read-JsonFile $ProductsFile @())

  if ($Request.Method -eq "GET" -and $Path -eq "/api/products") {
    return New-JsonResponse 200 @{ products = $Products }
  }

  if ($Request.Method -eq "GET" -and $Path -eq "/api/search") {
    $Search = ""
    if ($Query.ContainsKey("q")) {
      $Search = (Clean-Text $Query["q"] 80).ToLowerInvariant()
    }

    $Results = @($Products | Where-Object {
      $Haystack = "$($_.name) $($_.description)".ToLowerInvariant()
      [string]::IsNullOrWhiteSpace($Search) -or $Haystack.Contains($Search)
    })

    return New-JsonResponse 200 @{ query = $Search; results = $Results }
  }

  if ($Request.Method -eq "POST" -and ($Path -eq "/api/cart" -or $Path -eq "/api/orders")) {
    $Body = Read-BodyJson $Request
    $ProductId = Clean-Text $(if ($Body.productId) { $Body.productId } else { Get-ProductIdFromReferer $Request }) 80
    $Product = $Products | Where-Object { $_.id -eq $ProductId } | Select-Object -First 1

    if (-not $Product) {
      return New-JsonResponse 400 @{ error = "Product not found" }
    }

    $Quantity = [Math]::Max(1, [Math]::Min([int]$(if ($Body.quantity) { $Body.quantity } else { 1 }), 20))
    $Size = (Clean-Text $(if ($Body.size) { $Body.size } else { "M" }) 8).ToUpperInvariant()

    if (@($Product.sizes) -notcontains $Size) {
      return New-JsonResponse 400 @{ error = "Selected size is not available" }
    }

    if ($Path -eq "/api/cart") {
      return New-JsonResponse 200 @{
        item = @{
          productId = $Product.id
          name = $Product.name
          price = [int]$Product.price
          quantity = $Quantity
          size = $Size
          subtotal = ([int]$Product.price * $Quantity)
        }
      }
    }

    $Orders = To-Array (Read-JsonFile $OrdersFile @())
    $Order = [pscustomobject]@{
      id = "MM-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$((New-Guid).Guid.Substring(0, 6).ToUpperInvariant())"
      productId = $Product.id
      productName = $Product.name
      price = [int]$Product.price
      quantity = $Quantity
      size = $Size
      total = ([int]$Product.price * $Quantity)
      status = "new"
      createdAt = (Get-Date).ToUniversalTime().ToString("o")
    }

    $Orders = @($Orders) + $Order
    Write-JsonFile $OrdersFile $Orders
    return New-JsonResponse 201 @{ order = $Order }
  }

  if ($Request.Method -eq "POST" -and $Path -eq "/api/contact") {
    $Body = Read-BodyJson $Request
    $Messages = To-Array (Read-JsonFile $MessagesFile @())
    $Message = [pscustomobject]@{
      id = (New-Guid).Guid
      name = Clean-Text $Body.name 80
      email = Clean-Text $Body.email 120
      phone = Clean-Text $Body.phone 30
      message = Clean-Text $Body.message 1000
      createdAt = (Get-Date).ToUniversalTime().ToString("o")
    }

    $Messages = @($Messages) + $Message
    Write-JsonFile $MessagesFile $Messages
    return New-JsonResponse 201 @{ message = $Message }
  }

  return New-JsonResponse 404 @{ error = "Not found" }
}

function Serve-Static($Path) {
  if ($Path -eq "/") {
    $Path = "/index.html"
  }

  $RelativePath = [uri]::UnescapeDataString($Path).TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
  $FilePath = [System.IO.Path]::GetFullPath((Join-Path $Root $RelativePath))

  if (-not $FilePath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
    return New-JsonResponse 404 @{ error = "Not found" }
  }

  $Ext = [System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()
  $ContentType = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { "application/octet-stream" }
  return New-Response 200 $ContentType ([System.IO.File]::ReadAllBytes($FilePath))
}

function Write-HttpResponse($Stream, $Response) {
  $Reason = if ($Response.StatusCode -eq 200) { "OK" } elseif ($Response.StatusCode -eq 201) { "Created" } elseif ($Response.StatusCode -eq 400) { "Bad Request" } elseif ($Response.StatusCode -eq 404) { "Not Found" } else { "Internal Server Error" }
  $Header = "HTTP/1.1 $($Response.StatusCode) $Reason`r`nContent-Type: $($Response.ContentType)`r`nContent-Length: $($Response.BodyBytes.Length)`r`nConnection: close`r`nCache-Control: no-store`r`n`r`n"
  $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
  $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
  $Stream.Write($Response.BodyBytes, 0, $Response.BodyBytes.Length)
}

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$Listener.Start()

Write-Host "M&M Enterprises backend running at http://localhost:$Port"
Write-Host "Press Ctrl+C to stop."

try {
  while ($true) {
    $Client = $Listener.AcceptTcpClient()
    try {
      $Stream = $Client.GetStream()
      $Request = Read-HttpRequest $Stream

      if ($null -eq $Request) {
        continue
      }

      $TargetParts = $Request.Target.Split("?", 2)
      $Path = $TargetParts[0]
      $QueryString = if ($TargetParts.Count -gt 1) { $TargetParts[1] } else { "" }
      $Query = Get-QueryParams $QueryString

      if ($Path.StartsWith("/api/")) {
        $Response = Handle-Api $Request $Path $Query
      } else {
        $Response = Serve-Static $Path
      }

      Write-HttpResponse $Stream $Response
    } catch {
      $Response = New-JsonResponse 500 @{ error = "Server error"; detail = $_.Exception.Message }
      Write-HttpResponse $Stream $Response
    } finally {
      $Client.Close()
    }
  }
} finally {
  $Listener.Stop()
}
