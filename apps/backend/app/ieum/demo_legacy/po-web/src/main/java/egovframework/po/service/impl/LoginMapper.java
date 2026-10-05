package egovframework.po.service.impl;

import egovframework.po.service.LoginVO;
import egovframework.rte.psl.dataaccess.mapper.Mapper;

/**
 * 로그인 매퍼 (MyBatis, LoginMapper.xml)
 */
@Mapper("loginMapper")
public interface LoginMapper {

    LoginVO selectLoginUser(LoginVO loginVO) throws Exception;
}
