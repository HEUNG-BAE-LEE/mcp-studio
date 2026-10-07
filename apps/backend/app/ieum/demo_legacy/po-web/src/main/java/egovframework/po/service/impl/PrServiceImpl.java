package egovframework.po.service.impl;

import java.util.List;
import java.util.Map;

import javax.annotation.Resource;

import org.springframework.stereotype.Service;

import egovframework.po.service.PrSearchVO;
import egovframework.po.service.PrService;
import egovframework.po.service.PrVO;

/**
 * 구매요청 서비스 구현
 */
@Service("prService")
public class PrServiceImpl implements PrService {

    @Resource(name = "prMapper")
    private PrMapper prMapper;

    @Override
    public List<Map<String, Object>> selectPrList(PrSearchVO searchVO) throws Exception {
        return prMapper.selectPrList(searchVO);
    }

    @Override
    public void saveDraft(PrVO prVO) throws Exception {
        prMapper.insertPrDraft(prVO);
    }

    @Override
    public void submitPr(String prNo) throws Exception {
        prMapper.updatePrSubmit(prNo);
    }
}
