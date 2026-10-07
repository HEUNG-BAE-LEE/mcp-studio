package egovframework.po.service;

import java.io.Serializable;

/**
 * 거래처 목록 조회 조건
 */
public class VendSearchVO implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 거래처명 (부분 일치) */
    private String vendNm;

    public String getVendNm() {
        return vendNm;
    }

    public void setVendNm(String vendNm) {
        this.vendNm = vendNm;
    }
}
