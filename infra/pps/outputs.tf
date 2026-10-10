output "ieum_url" { value = "https://${module.ieum.fqdn}/ieum/" }
output "container_app_name" { value = module.ieum.name }
output "legacy_private_ip" { value = module.legacy_vm.private_ip }
output "legacy_vm_name" { value = module.legacy_vm.vm_name }
output "pg_fqdn" { value = module.legacy_db.fqdn }
output "key_vault_name" { value = module.vault.name }

# 반입 스크립트(deploy_legacy.sh)가 읽는다. Key Vault 공개 접근이 막힌 구독에서 apply 하는 PC 가 비밀값을 받는 유일한 경로다
output "pg_admin_password" {
  value     = module.legacy_db.admin_password
  sensitive = true
}
output "pg_reader_password" {
  value     = random_password.reader.result
  sensitive = true
}
