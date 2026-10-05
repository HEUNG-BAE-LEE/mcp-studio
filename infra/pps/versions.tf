terraform {
  required_version = ">= 1.7"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
  # 상태 저장소는 이 스택 밖에서 먼저 만든다(README 0단계). 값은 backend.hcl 로 넘긴다.
  # 이전 mcp-studio 상태 저장소(sttfstatemcpstudio)는 2026-09-21 삭제됐다 — 재사용하지 않는다.
  backend "azurerm" {}
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = false
    }
  }
  subscription_id = var.subscription_id
}
