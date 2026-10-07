package egovframework.po.service;

import java.io.Serializable;

/**
 * 발주 등록 VO
 */
public class PoVO implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 거래처 코드 */
    private String vendCd;

    /** 품목 코드 */
    private String itemCd;

    /** 수량 */
    private int qty;

    /** 단가 (원) */
    private int unitPrice;

    /** 결제 조건 (30:30일, 60:60일) */
    private String payTerm;

    public String getVendCd() {
        return vendCd;
    }

    public void setVendCd(String vendCd) {
        this.vendCd = vendCd;
    }

    public String getItemCd() {
        return itemCd;
    }

    public void setItemCd(String itemCd) {
        this.itemCd = itemCd;
    }

    public int getQty() {
        return qty;
    }

    public void setQty(int qty) {
        this.qty = qty;
    }

    public int getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(int unitPrice) {
        this.unitPrice = unitPrice;
    }

    public String getPayTerm() {
        return payTerm;
    }

    public void setPayTerm(String payTerm) {
        this.payTerm = payTerm;
    }
}
