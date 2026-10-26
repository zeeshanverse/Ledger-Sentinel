# Starts Spring Boot on http://localhost:8080 using the Maven wrapper (no global mvn needed)
Set-Location "$PSScriptRoot\backend"
.\mvnw.cmd spring-boot:run
