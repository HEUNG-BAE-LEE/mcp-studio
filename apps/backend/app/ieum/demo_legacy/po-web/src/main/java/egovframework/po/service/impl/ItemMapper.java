package egovframework.po.service.impl;

import org.apache.ibatis.annotations.Param;

import egovframework.po.service.ItemPriceVO;
import egovframework.rte.psl.dataaccess.mapper.Mapper;

/**
 * 품목 매퍼 (MyBatis, ItemMapper.xml)
 */
@Mapper("itemMapper")
public interface ItemMapper {

    ItemPriceVO selectItemPrice(@Param("itemCd") String itemCd, @Param("vendCd") String vendCd) throws Exception;
}
