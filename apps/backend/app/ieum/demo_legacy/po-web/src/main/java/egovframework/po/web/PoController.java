package egovframework.po.web;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.annotation.Resource;

import org.springframework.stereotype.Controller;
import org.springframework.ui.ModelMap;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.ModelAndView;

import egovframework.po.service.PoSearchVO;
import egovframework.po.service.PoService;
import egovframework.po.service.PoVO;

/**
 * 발주 관리 컨트롤러
 */
@Controller
public class PoController {

    @Resource(name = "poService")
    private PoService poService;

    /** 발주 목록 화면 */
    @RequestMapping("/poListView.do")
    public String poListView(ModelMap model) throws Exception {
        return "po/poList";
    }

    /** 발주 등록 화면. 팝업으로 열어도 같은 화면을 쓴다. */
    @RequestMapping(value = {"/poRegView.do", "/poPopupView.do"})
    public String poRegView(ModelMap model) throws Exception {
        return "po/poReg";
    }

    /**
     * 발주 목록 조회
     *
     * @param searchVO 조회 조건
     * @return 발주 목록
     */
    @RequestMapping(value = "/poList.do", method = RequestMethod.GET)
    public @ResponseBody Map<String, Object> poList(@ModelAttribute("searchVO") PoSearchVO searchVO) throws Exception {
        Map<String, Object> result = new HashMap<String, Object>();
        result.put("list", poService.selectPoList(searchVO));
        result.put("RSLT", "0000");
        return result;
    }

    /** 발주 상세 조회 */
    @RequestMapping(value = "/poDetail.do", method = RequestMethod.GET)
    @ResponseBody
    public Map<String, Object> poDetail(@RequestParam("poNo") String poNo) throws Exception {
        Map<String, Object> result = new HashMap<String, Object>();
        result.put("detail", poService.selectPoDetail(poNo));
        result.put("RSLT", "0000");
        return result;
    }

    /** 발주 등록 */
    @PostMapping("/poSave.do")
    @ResponseBody
    public Map<String, Object> poSave(PoVO poVO) throws Exception {
        Map<String, Object> result = new HashMap<String, Object>();
        result.put("poNo", poService.savePo(poVO));
        result.put("RSLT", "0000");
        return result;
    }

    /** 발주 승인 */
    @PostMapping("/poApprove.do")
    @ResponseBody
    public Map<String, Object> poApprove(@RequestParam String poNo) throws Exception {
        poService.approvePo(poNo);
        Map<String, Object> result = new HashMap<String, Object>();
        result.put("RSLT", "0000");
        return result;
    }

    /** 발주 목록 엑셀 다운로드 */
    @RequestMapping(value = "/poExcelDown.do", method = RequestMethod.GET)
    public ModelAndView poExcelDown(@ModelAttribute("searchVO") PoSearchVO searchVO) throws Exception {
        Map<String, Object> model = new HashMap<String, Object>();
        model.put("list", poService.selectPoList(searchVO));
        return new ModelAndView("excelView", model);
    }

    /**
     * 구 발주 목록. 신규 화면은 poList.do 를 쓴다.
     *
     * @deprecated poList.do 로 대체
     */
    @Deprecated
    @RequestMapping("/oldPoList.do")
    @ResponseBody
    public List<Map<String, Object>> oldPoList() throws Exception {
        return poService.selectOldPoList();
    }
}
