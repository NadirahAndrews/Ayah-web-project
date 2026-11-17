/*1. API DATA AND PAGE CONTROLS*/

"use strict";

(() => {
    const page= document.body.dataset.page;
    
    if (page !== "discover" && page !== "explore") return;
    
    const $ = (id) => document.getElementById(id);
    const params = new URLSearchParams(window.location.search);
    const API = "https://api.alquran.cloud/v1"; //read chapter or verse numbers fromt he page URL
    const cache = new Map();
}
)

/*DISCOVER PAGE*/

/*EXPLORE PAGE*/