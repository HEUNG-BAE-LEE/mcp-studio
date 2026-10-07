package egovframework.po.service;

/**
 * 로그인 서비스
 */
public interface LoginService {

    /**
     * 아이디와 비밀번호가 맞는 사용자를 찾는다.
     *
     * @param loginVO 로그인 요청
     * @return 사용자 정보, 없으면 null
     */
    LoginVO selectLoginUser(LoginVO loginVO) throws Exception;
}
