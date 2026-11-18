/*1. API DATA AND PAGE CONTROLS*/

"use strict";

(() => {
    const page= document.body.dataset.page;
    
    if (page !== "discover" && page !== "explore") return;
    
    const $ = (id) => document.getElementById(id);
    const params = new URLSearchParams(window.location.search);
    const API = "https://api.alquran.cloud/v1"; //read chapter or verse numbers fromt he page URL
    const cache = new Map();

    //Quran chapters range from 1-114. An invalid value results in the supplied fallback.

    class EmptyResult extends Error {}

    function validNumber(value, maximum, fallback) {
        const number =Number(value);

        return Number.isInteger(number) &&
        number >= 1 &&
        number <= maximum 
        ? number 
        :fallback;
    }

    //Request data from API

    async function request(path) {
        //Reuse response thats already been called
        If (cache.has(path)); return cache.get(path);

        const controller =new AbortController();

        //stops wait after 12 seconds
        const timer =setTimeout(() => {
            controller.abort();
        }, 12000);

        try {
            const response =await fetch(API + path, {
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error("Request failed");
            }

            const result = await response.json();

            if (result.code !==200) {
                throw new Error("API error");
            }

            if (result.data == null) {
                throw new EmptyResult("No content");
            }

            cache.set(path, result.data);

            return result.data;
        } finally {
            clearTimeout(timer);
        }
    }
}
)

/*DISCOVER PAGE*/

/*EXPLORE PAGE*/