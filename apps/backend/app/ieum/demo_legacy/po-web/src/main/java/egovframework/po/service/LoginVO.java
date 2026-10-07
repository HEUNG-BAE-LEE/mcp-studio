package egovframework.po.service;

import java.io.Serializable;

/**
 * 로그인 요청 VO
 */
public class LoginVO implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 사용자 아이디 */
    private String userId;

    /** 비밀번호 */
    private String userPw;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getUserPw() {
        return userPw;
    }

    public void setUserPw(String userPw) {
        this.userPw = userPw;
    }
}
