terraform {
  required_version = ">= 1.9"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.20"
    }
  }

  # 상태는 Azure Blob 에 둔다. 로컬 파일로 두면 이 디렉터리를 지운 사람이
  # 인프라를 더 이상 고칠 수 없게 되고, 두 사람이 동시에 apply 할 때 서로의
  # 변경을 덮어쓴다. Blob 백엔드는 상태를 잠근다.
  #
  # 이 스토리지 계정은 Terraform 이 관리하지 않는다(상태를 담는 그릇을 상태로
  # 관리하면 순환이 된다). 새 환경에서 처음 만들 때만 아래를 한 번 실행한다.
  #
  #   az storage account create -n <계정> -g <리소스그룹> -l koreacentral \
  #     --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 \
  #     --allow-blob-public-access false
  #   az storage container create -n tfstate --account-name <계정> --auth-mode login
  backend "azurerm" {
    resource_group_name  = "azure_test-a89a8649-741-rg001"
    storage_account_name = "sttfstatemcpstudio"
    container_name       = "tfstate"
    key                  = "mcp-studio.tfstate"
    use_azuread_auth     = true
  }
}

provider "azurerm" {
  subscription_id = var.subscription_id
  features {}
}
