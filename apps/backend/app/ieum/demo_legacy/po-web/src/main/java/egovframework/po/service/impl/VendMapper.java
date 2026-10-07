package egovframework.po.service.impl;

import java.util.List;
import java.util.Map;

import egovframework.po.service.VendSearchVO;
import egovframework.rte.psl.dataaccess.mapper.Mapper;

/**
 * 거래처 매퍼 (MyBatis, VendMapper.xml)
 */
@Mapper("vendMapper")
public interface VendMapper {

    List<Map<String, Object>> selectVendList(VendSearchVO searchVO) throws Exception;
}
