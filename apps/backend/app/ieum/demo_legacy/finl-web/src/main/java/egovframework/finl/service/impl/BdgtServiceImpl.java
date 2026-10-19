package egovframework.finl.service.impl;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import egovframework.finl.service.BdgtService;

/** 예산 확인 서비스 구현 */
@Service("bdgtService")
public class BdgtServiceImpl implements BdgtService {

    @Autowired
    private BdgtMapper bdgtMapper;

    @Override
    public List<Map<String, Object>> selectBdgtCnfm(Map<String, Object> param) throws Exception {
        return bdgtMapper.selectBdgtCnfm(param);
    }
}
