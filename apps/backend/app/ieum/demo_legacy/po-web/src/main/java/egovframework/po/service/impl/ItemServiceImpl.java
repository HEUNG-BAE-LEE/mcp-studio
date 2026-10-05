package egovframework.po.service.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import egovframework.po.service.ItemPriceVO;
import egovframework.po.service.ItemService;

/**
 * 품목 서비스 구현
 */
@Service("itemService")
public class ItemServiceImpl implements ItemService {

    private final ItemMapper itemMapper;

    @Autowired
    public ItemServiceImpl(ItemMapper itemMapper) {
        this.itemMapper = itemMapper;
    }

    @Override
    public ItemPriceVO selectItemPrice(String itemCd, String vendCd) throws Exception {
        return itemMapper.selectItemPrice(itemCd, vendCd);
    }
}
