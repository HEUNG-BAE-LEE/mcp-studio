package egovframework.finl.web;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import egovframework.finl.service.PymntService;

/**
 * 대금 청구·지급 연계 컨트롤러
 *
 * 2015년 구축 당시 인터페이스정의서(xlsx)만 남아 있고 기계가 읽는 명세는 없다.
 * 호출하는 쪽은 X-API-KEY 헤더로 인증한다(ApiKeyInterceptor).
 */
@Controller
@RequestMapping("/finl/pymnt")
public class FinlPymntController {

    @Autowired
    private PymntService pymntService;

    /** 대금 지급 상태 조회 — 대금청구번호 또는 계약번호/납품요구번호 */
    @RequestMapping(value = "/selectPymntSttus", method = RequestMethod.GET)
    @ResponseBody
    public Map<String, Object> selectPymntSttus(
            @RequestParam(value = "PYMNT_REQ_NO", required = false) String pymntReqNo,
            @RequestParam(value = "CNTRCT_NO", required = false) String cntrctNo) throws Exception {
        Map<String, Object> param = new HashMap<String, Object>();
        param.put("pymntReqNo", pymntReqNo);
        param.put("refNo", cntrctNo);
        return FinlResult.ok(pymntService.selectPymntSttus(param));
    }

    /** 수요기관별 대금 청구 목록 */
    @RequestMapping(value = "/selectPymntList", method = RequestMethod.GET)
    @ResponseBody
    public Map<String, Object> selectPymntList(
            @RequestParam(value = "DMINSTT_CD", required = false) String dminsttCd,
            @RequestParam(value = "PYMNT_STTS_CD", required = false) String pymntSttsCd) throws Exception {
        Map<String, Object> param = new HashMap<String, Object>();
        param.put("dminsttCd", dminsttCd);
        param.put("pymntSttsCd", pymntSttsCd);
        return FinlResult.ok(pymntService.selectPymntList(param));
    }

    /** 대금 청구 등록 — 쓰기. 운영 호출 금지 대상 */
    @RequestMapping(value = "/insertPymntReq", method = RequestMethod.POST)
    @ResponseBody
    public Map<String, Object> insertPymntReq(
            @RequestParam("REF_NO") String refNo,
            @RequestParam("REQ_AMT") String reqAmt) throws Exception {
        Map<String, Object> param = new HashMap<String, Object>();
        param.put("refNo", refNo);
        param.put("reqAmt", reqAmt);
        pymntService.insertPymntReq(param);
        return FinlResult.ok(pymntService.selectPymntSttus(param));
    }
}
