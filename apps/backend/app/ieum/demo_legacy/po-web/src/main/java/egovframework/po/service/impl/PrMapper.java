package egovframework.po.service.impl;

import java.util.List;
import java.util.Map;

import egovframework.po.service.PrSearchVO;
import egovframework.po.service.PrVO;
import egovframework.rte.psl.dataaccess.mapper.Mapper;

/**
 * 구매요청 매퍼 (MyBatis, PrMapper.xml)
 */
@Mapper("prMapper")
public interface PrMapper {

    List<Map<String, Object>> selectPrList(PrSearchVO searchVO) throws Exception;

    int insertPrDraft(PrVO prVO) throws Exception;

    int updatePrSubmit(String prNo) throws Exception;
}
