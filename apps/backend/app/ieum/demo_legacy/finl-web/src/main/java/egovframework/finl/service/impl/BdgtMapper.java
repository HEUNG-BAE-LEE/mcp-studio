package egovframework.finl.service.impl;

import java.util.List;
import java.util.Map;

import egovframework.rte.psl.dataaccess.mapper.Mapper;

/** 예산 매퍼 (MyBatis, BdgtMapper.xml) */
@Mapper("bdgtMapper")
public interface BdgtMapper {

    List<Map<String, Object>> selectBdgtCnfm(Map<String, Object> param) throws Exception;
}
