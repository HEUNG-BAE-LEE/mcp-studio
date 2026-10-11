output "client_id" {
  description = "워크플로의 azure/login client-id (비밀 아님 — 식별자)"
  value       = azuread_application_registration.this.client_id
}
output "principal_id" { value = azuread_service_principal.this.object_id }
