package egovframework.po.web;

import java.util.HashMap;
import java.util.Map;

import javax.annotation.Resource;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import egovframework.po.service.PrSearchVO;
import egovframework.po.service.PrService;
import egovframework.po.service.PrVO;

/**
 * 구매요청 관리 컨트롤러
 */
@Controller
public class PrController {

    @Resource(name = "prService")
    private PrService prService;

    /** 구매요청 목록 화면 */
    @RequestMapping("/prListView.do")
    public String prListView() throws Exception {
        return "pr/prList";
    }

    /** 구매요청 등록 화면 */
    @RequestMapping("/prRegView.do")
    public String prRegView() throws Exception {
        return "pr/prReg";
    }

    /** 구매요청 목록 조회 */
    @RequestMapping(value = "/prList.do", method = RequestMethod.GET)
    @ResponseBody
    public Map<String, Object> prList(PrSearchVO searchVO) throws Exception {
        Map<String, Object> result = new HashMap<String, Object>();
        result.put("list", prService.selectPrList(searchVO));
        result.put("RSLT", "0000");
        return result;
    }

    /** 구매요청 임시저장 */
    @PostMapping("/prDraftSave.do")
    @ResponseBody
    public Map<String, Object> prDraftSave(PrVO prVO) throws Exception {
        prService.saveDraft(prVO);
        Map<String, Object> result = new HashMap<String, Object>();
        result.put("RSLT", "0000");
        return result;
    }

    /** 구매요청 상신 */
    @PostMapping("/prSubmit.do")
    @ResponseBody
    public Map<String, Object> prSubmit(@RequestParam("prNo") String prNo) throws Exception {
        prService.submitPr(prNo);
        Map<String, Object> result = new HashMap<String, Object>();
        result.put("RSLT", "0000");
        return result;
    }
}
