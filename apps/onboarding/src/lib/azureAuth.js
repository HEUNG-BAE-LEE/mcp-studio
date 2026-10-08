// 엠버링크 azureAuth 자리 — 이음 시연은 preview 다.
// Entra(MSAL) 로그인 대신 조달청 G-Cloud 를 재현한 가상 계정으로 바로 들어간다. 인벤토리는 서버가 돌려준다.
// 실제 Azure 구독을 훑으려면 엠버링크 azureAuth.js(MSAL)와 inventory_routes 를 그대로 붙이면 된다.
const ACCOUNT = { name: "시연 운영자", username: "operator@gcloud-demo.local", tenantId: "pps-gcloud-demo" };
let signedIn = false;

export function azureConfigured() { return true; }
export function cancelAzureLogin() {}
export async function azureLogin() {
  await new Promise((r) => setTimeout(r, 700));      // 로그인 창이 열렸다 닫히는 정도의 시간
  signedIn = true;
  return { ...ACCOUNT, armToken: "preview", idToken: "" };
}
export async function getArmToken() {
  if (!signedIn) signedIn = true;
  return "preview";
}
export function azureLogout() { signedIn = false; }
