package egovframework.po.service.impl;

import java.util.List;
import java.util.Map;

import egovframework.po.service.PoSearchVO;
import egovframework.rte.psl.dataaccess.mapper.Mapper;

/**
 * 발주 매퍼 (MyBatis, PoMapper.xml)
 */
@Mapper("poMapper")
public interface PoMapper {

    List<Map<String, Object>> selectPoList(PoSearchVO searchVO) throws Exception;

    Map<String, Object> selectPoDetail(String poNo) throws Exception;

    String selectNextPoNo() throws Exception;

    int insertPo(Map<String, Object> param) throws Exception;

    int updatePoStatus(Map<String, Object> param) throws Exception;

    List<Map<String, Object>> selectOldPoList() throws Exception;
}
