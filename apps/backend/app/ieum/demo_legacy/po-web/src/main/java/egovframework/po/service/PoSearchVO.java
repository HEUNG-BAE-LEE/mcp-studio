package egovframework.po.service;

import java.io.Serializable;

/**
 * 발주 목록 조회 조건
 */
public class PoSearchVO implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 발주일 시작 (yyyyMMdd) */
    private String fromDt;

    /** 발주일 종료 (yyyyMMdd) */
    private String toDt;

    private String vendCd; // 거래처 코드

    private String sttsCd; // 상태 코드 (R:요청, A:승인, C:취소)

    public String getFromDt() {
        return fromDt;
    }

    public void setFromDt(String fromDt) {
        this.fromDt = fromDt;
    }

    public String getToDt() {
        return toDt;
    }

    public void setToDt(String toDt) {
        this.toDt = toDt;
    }

    public String getVendCd() {
        return vendCd;
    }

    public void setVendCd(String vendCd) {
        this.vendCd = vendCd;
    }

    public String getSttsCd() {
        return sttsCd;
    }

    public void setSttsCd(String sttsCd) {
        this.sttsCd = sttsCd;
    }
}
