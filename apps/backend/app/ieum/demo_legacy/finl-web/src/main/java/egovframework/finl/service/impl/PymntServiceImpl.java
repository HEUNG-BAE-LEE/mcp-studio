package egovframework.finl.service.impl;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import egovframework.finl.service.PymntService;

/** 대금 청구·지급 서비스 구현 */
@Service("pymntService")
public class PymntServiceImpl implements PymntService {

    @Autowired
    private PymntMapper pymntMapper;

    @Override
    public List<Map<String, Object>> selectPymntSttus(Map<String, Object> param) throws Exception {
        return pymntMapper.selectPymntSttus(param);
    }

    @Override
    public List<Map<String, Object>> selectPymntList(Map<String, Object> param) throws Exception {
        return pymntMapper.selectPymntList(param);
    }

    @Override
    public int insertPymntReq(Map<String, Object> param) throws Exception {
        return pymntMapper.insertPymntReq(param);
    }
}
