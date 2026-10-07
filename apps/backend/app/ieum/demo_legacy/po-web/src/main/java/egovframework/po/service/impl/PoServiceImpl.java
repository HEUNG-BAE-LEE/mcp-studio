package egovframework.po.service.impl;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.annotation.Resource;

import org.springframework.stereotype.Service;

import egovframework.po.service.PoSearchVO;
import egovframework.po.service.PoService;
import egovframework.po.service.PoVO;
import egovframework.rte.fdl.cmmn.EgovAbstractServiceImpl;

/**
 * 발주 서비스 구현
 */
@Service("poService")
public class PoServiceImpl extends EgovAbstractServiceImpl implements PoService {

    @Resource(name = "poMapper")
    private PoMapper poMapper;

    @Override
    public List<Map<String, Object>> selectPoList(PoSearchVO searchVO) throws Exception {
        return poMapper.selectPoList(searchVO);
    }

    @Override
    public Map<String, Object> selectPoDetail(String poNo) throws Exception {
        return poMapper.selectPoDetail(poNo);
    }

    @Override
    public String savePo(PoVO poVO) throws Exception {
        String poNo = poMapper.selectNextPoNo();
        Map<String, Object> param = new HashMap<String, Object>();
        param.put("poNo", poNo);
        param.put("vendCd", poVO.getVendCd());
        param.put("itemCd", poVO.getItemCd());
        param.put("qty", poVO.getQty());
        param.put("unitPrice", poVO.getUnitPrice());
        param.put("payTerm", poVO.getPayTerm());
        poMapper.insertPo(param);
        return poNo;
    }

    @Override
    public void approvePo(String poNo) throws Exception {
        changeStatus(poNo, "A");
    }

    @Override
    public List<Map<String, Object>> selectOldPoList() throws Exception {
        return poMapper.selectOldPoList();
    }

    /**
     * 발주 상태를 바꾼다. 승인(A)이 쓰고, 이름과 달리 SELECT 가 아니라 UPDATE 다.
     */
    private void changeStatus(String poNo, String sttsCd) throws Exception {
        Map<String, Object> param = new HashMap<String, Object>();
        param.put("poNo", poNo);
        param.put("sttsCd", sttsCd);
        poMapper.updatePoStatus(param);
    }
}
