package egovframework.po.service.impl;

import javax.annotation.Resource;

import org.springframework.stereotype.Service;

import egovframework.po.service.LoginService;
import egovframework.po.service.LoginVO;
import egovframework.rte.fdl.cmmn.EgovAbstractServiceImpl;

/**
 * 로그인 서비스 구현
 */
@Service("loginService")
public class LoginServiceImpl extends EgovAbstractServiceImpl implements LoginService {

    @Resource(name = "loginMapper")
    private LoginMapper loginMapper;

    @Override
    public LoginVO selectLoginUser(LoginVO loginVO) throws Exception {
        return loginMapper.selectLoginUser(loginVO);
    }
}
