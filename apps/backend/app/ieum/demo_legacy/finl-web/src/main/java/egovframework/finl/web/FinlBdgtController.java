package egovframework.finl.web;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import egovframework.finl.service.BdgtService;

/**
 * 수요기관 예산 확인 연계 컨트롤러
 */
@Controller
@RequestMapping("/finl/bdgt")
public class FinlBdgtController {

    @Autowired
    private BdgtService bdgtService;

    /** 수요기관 예산 배정·집행 확인 */
    @RequestMapping(value = "/selectBdgtCnfm", method = RequestMethod.GET)
    @ResponseBody
    public Map<String, Object> selectBdgtCnfm(
            @RequestParam("DMINSTT_CD") String dminsttCd,
            @RequestParam(value = "BDGT_YR", required = false) String bdgtYr) throws Exception {
        Map<String, Object> param = new HashMap<String, Object>();
        param.put("dminsttCd", dminsttCd);
        param.put("bdgtYr", bdgtYr);
        return FinlResult.ok(bdgtService.selectBdgtCnfm(param));
    }
}
