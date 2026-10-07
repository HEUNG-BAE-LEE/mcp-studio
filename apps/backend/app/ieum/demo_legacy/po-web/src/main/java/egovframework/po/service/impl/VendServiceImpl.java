package egovframework.po.service.impl;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import egovframework.po.service.VendSearchVO;
import egovframework.po.service.VendService;

/**
 * 거래처 서비스 구현
 */
@Service("vendService")
public class VendServiceImpl implements VendService {

    @Autowired
    private VendMapper vendMapper;

    @Override
    public List<Map<String, Object>> selectVendList(VendSearchVO searchVO) throws Exception {
        return vendMapper.selectVendList(searchVO);
    }
}
