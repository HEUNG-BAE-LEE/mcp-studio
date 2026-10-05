package egovframework.po.web;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;

import org.springframework.stereotype.Controller;
import org.springframework.ui.ModelMap;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.ModelAndView;

import egovframework.po.service.LoginService;
import egovframework.po.service.LoginVO;

/**
 * 로그인, 로그아웃과 메인 화면을 처리하는 컨트롤러
 */
@Controller
public class LoginController {

    @Resource(name = "loginService")
    private LoginService loginService;

    /** 로그인 화면 */
    @RequestMapping("/login.do")
    public String loginView() throws Exception {
        return "login/login";
    }

    /**
     * 로그인 처리
     * 성공하면 세션에 사용자 정보를 담는다.
     */
    @RequestMapping(value = "/loginProc.do", method = RequestMethod.POST)
    public ModelAndView loginProc(@ModelAttribute("loginVO") LoginVO loginVO, HttpServletRequest request) throws Exception {
        ModelAndView mav = new ModelAndView("jsonView");
        LoginVO user = loginService.selectLoginUser(loginVO);
        if (user == null) {
            mav.addObject("RSLT", "9999");
            mav.addObject("MSG", "아이디 또는 비밀번호가 올바르지 않습니다.");
            return mav;
        }
        HttpSession session = request.getSession();
        session.setAttribute("loginUser", user);
        mav.addObject("RSLT", "0000");
        return mav;
    }

    /** 로그아웃 후 로그인 화면으로 보낸다 */
    @RequestMapping("/logout.do")
    public String logout(HttpSession session) throws Exception {
        session.invalidate();
        return "redirect:/login.do";
    }

    /** 메인 화면 */
    @RequestMapping("/main.do")
    public String main(ModelMap model) throws Exception {
        return "main/main";
    }
}
