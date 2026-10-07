package egovframework.po.service;

import java.io.Serializable;

/**
 * 구매요청 목록 조회 조건
 */
public class PrSearchVO implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 요청 부서 코드 */
    private String deptCd;

    /** 상태 코드 (D:임시저장, S:상신, A:승인) */
    private String sttsCd;

    public String getDeptCd() {
        return deptCd;
    }

    public void setDeptCd(String deptCd) {
        this.deptCd = deptCd;
    }

    public String getSttsCd() {
        return sttsCd;
    }

    public void setSttsCd(String sttsCd) {
        this.sttsCd = sttsCd;
    }
}
