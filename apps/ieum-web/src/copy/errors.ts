// 서버 문장이 없을 때의 실패 문구. 서버 resultMsg가 있으면 그것을 그대로 쓴다
export const NETWORK_FAILED = '서버에 연결하지 못했습니다. 백엔드가 켜져 있는지 확인해 주세요.';
export const VALIDATION_FAILED = '보낸 값의 형식이 맞지 않습니다.';
export const UNEXPECTED_RESPONSE = '서버 응답을 읽지 못했습니다.';
export const SCENARIO_FAILED = '시험용 실패입니다(?mock 시나리오).';
const HTTP_UNPROCESSABLE = 422;
export const statusFailed = (status: number) =>
  status === HTTP_UNPROCESSABLE ? VALIDATION_FAILED : `요청에 실패했습니다. (HTTP ${status})`;
