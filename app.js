/*1. API DATA AND PAGE CONTROLS*/

"use strict";

(() => {
    const page= document.body.dataset.page;
    
    if (page !== "discover" && page !== "explore") return;
    
    const $ = (id) => document.getElementById(id);
    const params = new URLSearchParams(window.location.search);
    const API = "https://api.alquran.cloud/v1"; //read chapter or verse numbers fromt the page URL
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
        if (cache.has(path)) return cache.get(path);

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

    //Retrieving Arabic and English texts from the API

    async function editions(path) {
        const data = await request(
            path + "/editions/quran-uthmani,en.sahih"
        );

        if (!Array.isArray(data)) {
            throw new Error("Invalid response");
        }

        const arabic = data.find((item) =>
            item.edition?.identifier === "quran-uthmani"
        );

        const english = data.find((item) =>
            item.edition?.identifier === "en.sahih"
        );

        if (!arabic || !english) {
            throw new Error("Missing edition");
        }
         return { arabic, english};
    }

    //Matching verse to respective translation

    function matchVerse(arabic, english) {
        if (
            !arabic || !english ||
            !validNumber(arabic.number, 6236, 0) ||
            !validNumber(arabic.numberInSurah, 286, 0) ||
            arabic.number !== english.number ||
            arabic.numberInSurah !== english.numberInSurah ||
            typeof arabic.text !== "string" ||
            !arabic.text.trim() ||
            typeof english.text !== "string" ||
            !english.text.trim()
        ) {
            throw new Error("Incomplete or mismatched verse");
        }

        return {
            number: arabic.number,
            local: arabic.numberInSurah,
            arabic: arabic.text,
            english: english.text
        };
    }

    //Loading, errors and success results

    function showState(kind) {
        const success = kind === "success";

        $("api-state").hidden = success;
        $("api-state").dataset.state = kind;

        const resultID = page === "discover"
        ? "verse-result"
        : "chapter-result";

        $(resultID).hidden = !success;

        $("reading-region").setAttribute(
            "aria-busy",
            String(kind === "loading")
        );

        $("retry").hidden =
        success || kind === "loading";

        const messages = {
            loading: [
                "Loading your reading.",
                "Retrieving Arabic and English text."
            ],
            empty: [
                "No test was returned.",
                "Please try again"
            ],
            error: [
                "The text could not load.",
                "Check your connection, then try again."
            ]
        };

        if (!success) {
            $("state-title").textContent = messages[kind][0];
            $("state-message"). textContent = messages[kind][1];
        }

        function showError(error) {
            showState(
                error instanceof EmptyResult ? "empty" : "error"
            );
        }
    }

    //Page refresh opens the same verse/chapter

    function updateURL(values) {
        const url = new URL(window.location.href);

        Object.entries(values).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });

        try {
            history.replaceState(null, "", url);
        } catch {
            //Reading still works if URL updates are blocked
        }
    }
}
)

/*DISCOVER PAGE*/

//Audio player preparation

function startDiscover() {
    let current = null;
    let busy = false;
    let audioVersion = 0;

    const player = $("recitation");

    //select different verse from previous one

    function randomVerse(previous) {
        let number;

        do {
            number = Math.floor(Math.random() * 6236) + 1;
        } while (number === previous);

        return number;
    }

    let requested = validNumber(
        params.get("ayah"),
        6236,
        randomVerse()
    );

    //clear prev audio when a new verse is displayed

    function resetAudio() {
        audioVersion++;

        player.pause();
        player.removeAttribute("src");
        player.load();

        $("audio-area").hidden = true;
        $("audio-message").textContent = "";
        $("listen").textContent = "Listen";
        $("listen").disabled = true;
    }

    //Load and display a verse

    async function loadVerse(number) {
        if (busy) return;

        busy = true;
        requested = number;
        current = null;

        resetAudio();

        $("next-verse").disabled = true;
        showState("loading");

        try {
            const { arabic, english} = await editions(
                "/ayah/" + number 
            );

            const verse = matchVerse(arabic, english);

            if (
                verse.number !== number ||
                !validNumber(arabic.surah?.number, 114, 0) ||
                arabic.surah.number !== english.surah?.number ||
                !arabic.surah.englishName
            ) {
                throw new Error("Invalid verse reference");
            }

            current = verse;

            $("verse-ref").textContent =
            "SURAH" + arabic.surah.number + " / VERSE" + verse.local;

            $("verse-surah").textContent =
            arabic.surah.englishName;

            $("verse-arabic").textContent =
            verse.arabic;

            $("verse-translation").textContent =
            verse.english;

            $("explore-link").href =
            "explore.html?surah=" + arabic.surah.number + "&ayah" + verse.local;

            updateURL({ ayah: number });

            showState("success");
            $("listen").disabled = false;

        } catch (error) {
            cache.clear();
            showError(error);
        } finally {
            busy = false;
            $("next-verse").disabled = false;
        }
    }

    //Connecting buttons and audio events
    
    //-requesting another verse
    $("next-verse").addEventListener("click", () => {
        loadVerse(randomVerse(requested));
    });

    //-retrying the same verse after an error
    $("retry").addEventListener("click", () => {
        loadVerse(requested);
    });

    //-play/pause recitation
    $("listen").addEventListener("click", async () => {
        if (!current || busy) return;

        if (!player.paused) {
            player.pause();
            return;
        }

        const version = ++audioVersion;

        $("listen").disabled = true;

        $("audio-message").textContent =
        "Loading recitation.";

        try {
            if (!player.getAttribute("src")) {
                const data = await request(
                    "/ayah/" + current.number + "/ar.alafasy"
                );

                //ignore audio from an older verse
                if (version !== audioVersion) return;

                if (
                    data.number !== current.number ||
                    !data.audio
                ) {
                    throw new Error("Audio unavailable");
                }

                const url = new URL(data.audio);

                if (url.protocol !== "https:") {
                    throw new Error("Invalid audio URL");
                }

                player.src = url.href;
            }

            $("audio-area").hidden = false;

            await player.play();

            if (version === audioVersion) {
                $("audio-message").textContent = "";
            }
        } catch {
            if (version === audioVersion) {
                cache.clear();

                $("audio-message").textContent =
                "Audio could not start. Try Listen again" + "or use the audio controls.";
            }
        } finally {
            if (version === audioVersion) {
                $("listen").disabled = false;

                $("listen").textContent =
                player.paused ? "Listen" : "Pause";
            }
        }
    });

    //updating the button when native audio controls are used.
    ["play", "pause", "ended"].forEach((event) => {
        player.addEventListener(event, () => {
            $("listen").textContent =
            player.paused ? "Listen" : "Pause";
        });
    });

    //allowing for retry on a failed audio file
    player.addEventListener("error", () => {
        if (!player.getAttribute("src")) return;

        audioVersion++;
        cache.clear();

        player.removeAttribute("src");

        $("listen").disabled = !current || busy;
        $("listen").textContent = "Retry audio";

        $("audio-message").textContent =
        "The recitation could not be played. Try again.";
    });

    //load 1st verse when discovery page opens
    loadVerse(requested);
}




/*EXPLORE PAGE*/