package egovframework.finl.service.impl;

import java.util.List;
import java.util.Map;

import egovframework.rte.psl.dataaccess.mapper.Mapper;

/** 대금 매퍼 (MyBatis, PymntMapper.xml) */
@Mapper("pymntMapper")
public interface PymntMapper {

    List<Map<String, Object>> selectPymntSttus(Map<String, Object> param) throws Exception;

    List<Map<String, Object>> selectPymntList(Map<String, Object> param) throws Exception;

    int insertPymntReq(Map<String, Object> param) throws Exception;
}
