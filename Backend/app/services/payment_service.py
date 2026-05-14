import hashlib
import hmac
import json
import time
import httpx
import os
from typing import Optional, Dict, Any

from app.Core.config import settings

async def create_momo_payment(
    order_id: str,
    amount: int,
    order_info: str,
    redirect_url: str,
    ipn_url: str,
    extra_data: str = ""
) -> Dict[str, Any]:
    request_id = order_id # Matching user snippet: orderId = partnerCode + new Date().getTime(); requestId = orderId;
    request_type = "payWithMethod"
    
    raw_signature = (
        f"accessKey={settings.MOMO_ACCESS_KEY}&amount={amount}&extraData={extra_data}"
        f"&ipnUrl={ipn_url}&orderId={order_id}&orderInfo={order_info}"
        f"&partnerCode={settings.MOMO_PARTNER_CODE}&redirectUrl={redirect_url}"
        f"&requestId={request_id}&requestType={request_type}"
    )
    
    signature = hmac.new(
        settings.MOMO_SECRET_KEY.encode('utf-8'),
        raw_signature.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    payload = {
        "partnerCode": settings.MOMO_PARTNER_CODE,
        "partnerName": "Cabin AI",
        "storeId": "CabinStore",
        "requestId": request_id,
        "amount": amount,
        "orderId": order_id,
        "orderInfo": order_info,
        "redirectUrl": redirect_url,
        "ipnUrl": ipn_url,
        "lang": "vi",
        "requestType": request_type,
        "autoCapture": True,
        "extraData": extra_data,
        "orderGroupId": "",
        "signature": signature
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(settings.MOMO_ENDPOINT, json=payload)
            print(f"MoMo Request: {json.dumps(payload)}")
            print(f"MoMo Response: {response.status_code} - {response.text}")
            return response.json()
        except Exception as e:
            print(f"MoMo Error: {str(e)}")
            return {"resultCode": -1, "message": f"Connection error: {str(e)}"}

async def create_zalopay_payment(
    order_id: str,
    amount: int,
    order_info: str,
    redirect_url: str,
    callback_url: str,
    app_user: str = "guest"
) -> Dict[str, Any]:
    # Format: YYMMDD_orderid
    app_trans_id = f"{time.strftime('%y%m%d')}_{order_id}"
    app_time = int(time.time() * 1000)
    embed_data = json.dumps({"redirecturl": redirect_url}, separators=(',', ':'))
    item = json.dumps([], separators=(',', ':'))
    
    # ZaloPay MAC: app_id|app_trans_id|app_user|amount|app_time|embed_data|item
    raw_mac = f"{settings.ZALOPAY_APP_ID}|{app_trans_id}|{app_user}|{amount}|{app_time}|{embed_data}|{item}"
    mac = hmac.new(
        settings.ZALOPAY_KEY1.encode('utf-8'),
        raw_mac.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    payload = {
        "app_id": int(settings.ZALOPAY_APP_ID),
        "app_trans_id": app_trans_id,
        "app_user": app_user,
        "app_time": app_time,
        "item": item,
        "embed_data": embed_data,
        "amount": amount,
        "description": order_info,
        "bank_code": "",
        "callback_url": callback_url,
        "mac": mac
    }

    async with httpx.AsyncClient() as client:
        try:
            # ZaloPay V2 uses x-www-form-urlencoded
            response = await client.post(settings.ZALOPAY_ENDPOINT, data=payload)
            print(f"ZaloPay Request: {json.dumps(payload)}")
            print(f"ZaloPay Response: {response.status_code} - {response.text}")
            return response.json()
        except Exception as e:
            print(f"ZaloPay Error: {str(e)}")
            return {"return_code": -1, "return_message": f"Connection error: {str(e)}"}

def verify_momo_signature(data: Dict[str, Any]) -> bool:
    # MoMo IPN signature components for captureWallet
    access_key = settings.MOMO_ACCESS_KEY
    amount = str(data.get("amount", ""))
    extra_data = data.get("extraData", "")
    message = data.get("message", "")
    order_id = data.get("orderId", "")
    order_info = data.get("orderInfo", "")
    order_type = data.get("orderType", "")
    partner_code = data.get("partnerCode", "")
    pay_type = data.get("payType", "")
    request_id = data.get("requestId", "")
    response_time = str(data.get("responseTime", ""))
    result_code = str(data.get("resultCode", ""))
    trans_id = str(data.get("transId", ""))

    raw_signature = (
        f"accessKey={access_key}&amount={amount}&extraData={extra_data}&message={message}"
        f"&orderId={order_id}&orderInfo={order_info}&orderType={order_type}"
        f"&partnerCode={partner_code}&payType={pay_type}&requestId={request_id}"
        f"&responseTime={response_time}&resultCode={result_code}&transId={trans_id}"
    )
    
    generated_signature = hmac.new(
        settings.MOMO_SECRET_KEY.encode('utf-8'),
        raw_signature.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(generated_signature, data.get("signature", ""))

def verify_zalopay_mac(data: str, request_mac: str) -> bool:
    generated_mac = hmac.new(
        settings.ZALOPAY_KEY2.encode('utf-8'),
        data.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(generated_mac, request_mac)
