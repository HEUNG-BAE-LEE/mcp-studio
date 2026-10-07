package egovframework.po.service;

import java.io.Serializable;

/**
 * 품목 단가 조회 결과 VO (응답에만 쓴다)
 */
public class ItemPriceVO implements Serializable {

    private static final long serialVersionUID = 1L;

    private String itemCd;
    private String itemNm;
    private String vendCd;
    private int unitPrice;
    private String currency;

    public String getItemCd() {
        return itemCd;
    }

    public void setItemCd(String itemCd) {
        this.itemCd = itemCd;
    }

    public String getItemNm() {
        return itemNm;
    }

    public void setItemNm(String itemNm) {
        this.itemNm = itemNm;
    }

    public String getVendCd() {
        return vendCd;
    }

    public void setVendCd(String vendCd) {
        this.vendCd = vendCd;
    }

    public int getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(int unitPrice) {
        this.unitPrice = unitPrice;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }
}
