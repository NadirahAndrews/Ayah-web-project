/*1. API DATA AND PAGE CONTROLS*/

"use strict";

(() => {
    const page= document.body.dataset.page;
    
    if (page !== "home" && page !== "discover" && page !== "explore") { 
        return;
    }
    
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
                "No text was returned.",
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

        if (success) {
            animateReading($(resultID));
            
            if (page === "explore") {
                animateSections();
            }

            if (window.ScrollTrigger) {
                window.ScrollTrigger.refresh();
            }
        }
        
    }

    function showError(error) {
        showState(
            error instanceof EmptyResult ? "empty" : "error"
        );
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
/*GSAP MOTION */    

//Page animations: introductory element sequence
function animateEntrance() {
    const elements = document.querySelectorAll(
        "[data-intro]"
    );

    if (!elements.length || !window.gsap) return;

    const isHome = page === "home";

    window.gsap.fromTo(
        elements,
        {
            opacity: isHome ? 0 : 0.35,
            y: isHome ? 32 : 12
        },
        {
            opacity: 1,
            y: 0,
            duration: isHome ? 0.7 : 0.55,
            stagger: isHome ? 0.14 : 0.08,
            ease: "power2.out",
            clearProps: "opacity,transform"
        }
    );
}

//Home page scroll trigger

function animateSections() {
    if (!window.gsap || !window.ScrollTrigger) return;

    if (page === "explore" && $("chapter-result").hidden) {
        return;
    }

    const sections = document.querySelectorAll(
        "[data-reveal]"
    );

    sections.forEach((section) => {

        if (section.dataset.revealReady === "true") return;
        section. dataset.revealReady = "true";
        const revealOnce = page !== "home";

        function reveal(direction) {

            if (section.contains(document.activeElement)) {
                return;
            }

            window.gsap.killTweensOf(section);

            window.gsap.fromTo(
                section,
                {
                    opacity: 0.25,
                    y: direction * (revealOnce ? 16 : 55)
                },
                {
                    opacity: 1,
                    y: 0,
                    duration: revealOnce ? 0.5 : 0.85,
                    ease: "power3.out",
                    clearProps: "opacity,transform"
                }
            );
        }

        window.ScrollTrigger.create({
            trigger: section,
            start: "top 90%",
            end: "bottom 10%",

            once: revealOnce,

            onEnter: () => {
                reveal(1);
            },

            onEnterBack: () => {
                if (!revealOnce) {
                    reveal(-1);
                }
            }
        });
    });
}

function animateTerminology() {
    if (!window.gsap || !window.ScrollTrigger) return;

    const stage = document.querySelector(".term-stage");

    if (!stage) return;

    const cards = Array.from(
        stage.querySelectorAll(".term-panel")
    );

    if (!cards.length) return;

    const gsap = window.gsap;
    const media = gsap.matchMedia();

    media.add(
        {
            large:
            "(min-width: 800px) and (min-height: 650px)",
            small: 
            "(max-width: 799px), (max-height: 649px)"
        },

        (context) => {
            //smaller screens - vertical cards.
            if (!context.conditions.large) {
                cards.forEach((card) => {
                    gsap.fromTo(
                        card,
                        {
                            opacity: 0.3,
                            y: 60,
                            scale: 0.96
                        },
                        {
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            duration: 0.8,
                            ease: "power3.out",

                            scrollTrigger: {
                                trigger: card,
                                start: "top 75%",
                                end: "bottom 10%",
                                toggleActions: 
                                "play reverse play reverse"
                            }
                        }
                    );
                });

                return;
            }

            //Larger screens overlap
            stage.classList.add("is-stacked");

            cards.forEach((card, index) => {
                gsap.set(card, {
                    zIndex: index + 1,
                    xPercent: index === 0 ? 0 : 110,
                    rotation: index === 0 ? 0 : 7,
                    scale: 1,
                    yPercent: 0,
                    opacity: 1,
                    transformOrigin: "50% 100%"
                });

                gsap.set(
                    card.querySelector(".term-copy"),
                    {
                        x: 45,
                        opacity: 0,
                        clipPath: "inset(0% 100% 0% 0%)"
                    }
                );
            });

            const timeline = gsap.timeline({
                defaults: {
                    ease: "none"
                },

                scrollTrigger: {
                    trigger: stage,
                    start: "top top",

                    end: () =>
                        "+=" + (
                            window.innerHeight *
                            cards.length *
                            1.4
                        ),

                        pin: true,
                        pinSpacing: true,
                        scrub: 0.65,
                        anticipatePin: 1,
                        invalidateOnRefresh: true
                }
            });

            cards.forEach((card, index) => {
                const copy = card.querySelector(".term-copy");

                if (index > 0) {
                    const previous = cards[index - 1];
                    const slotLabel = "slot-" + index;

                    timeline.addLabel(slotLabel);

                    //push prev card back 
                    timeline.to(
                        previous,
                        {
                            scale: 0.91,
                            yPercent: -4,
                            opacity: 0.35,
                            duration: 1
                        },
                        slotLabel
                    );

                    //slide next card forward
                    timeline.to(
                        card,
                        {
                            xPercent: 0,
                            rotation: 0,
                            duration: 1,
                            ease: "power2.out"
                        },
                        slotLabel
                    );
                }

                const textLabel = "text-" + index;

                timeline.addLabel(textLabel);

                //Slide the English text into position.
                timeline.to(
                    copy,
                    {
                        x: 0,
                        opacity: 1,
                        duration: 0.35
                    },
                    textLabel
                );

                //Reveal text like typewriter
                timeline.to(
                    copy,
                    {
                        clipPath: "inset(0% 0% 0% 0%)",
                        duration: 0.9,
                        ease: "steps(24)"
                    },
                    textLabel
                );

                //scrolling distance for reading
                timeline.to(card, {
                    xPercent: 0,
                    duration: 0.55
                });
            });

            //return to normal layout on smaller
            return () => {
                stage.classList.remove("is-stacked");
            };
        }
    );
}

//Animate reading content display

function animateReading(element) {
    if (!element || !window.gsap) {
        return;
    }

    //Halt a prev animation if user moves too quickly

    window.gsap.killTweensOf(element);

    window.gsap.fromTo(
        element,
        {
            opacity: page === "discover" ? 0 : 0.35,
            y: 8
        },
        {
            opacity: 1,
            y: 0,
            duration: page === "discover" ? 0.6 : 0.35,
            ease: "power2.out",
            clearProps: "opacity,transform"
        }
    );
}

// Initialising animation features

function startMotion() {
    //allow reading to still work if GSAP doesnt load
    if (!window.gsap) return;

    if (window.ScrollTrigger) {
        window.gsap.registerPlugin(
            window.ScrollTrigger
        );
    }

    animateEntrance();
    animateTerminology();
    animateSections();

    if (window.ScrollTrigger) {
        window.ScrollTrigger.sort();
        window.ScrollTrigger.refresh();
    }

    //Recalculate scroll positions after the fonts load.
    if (document.fonts && window.ScrollTrigger) {
        document.fonts.ready.then(() =>{
            window.ScrollTrigger.refresh();
        });
    }
}
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
            "SURAH " + arabic.surah.number + " / VERSE" + verse.local;

            $("verse-surah").textContent =
            arabic.surah.englishName;

            $("verse-arabic").textContent =
            verse.arabic;

            $("verse-translation").textContent =
            verse.english;

            $("explore-link").href =
            "explore.html?surah=" + arabic.surah.number + "&ayah=" + verse.local;

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
                "Audio could not start. Try Listen again or use the audio controls.";
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

function startExplore() {
    let chapters = [];
    let chapter = null;

    let chosen = validNumber(
        params.get("surah"),
        114,
        1
    );
    
    let selected = validNumber(
        params.get("ayah"),
        286,
        1
    );

    let offset = 0;
    let requestVersion = 0;
    let scale = 1;

    const pageSize = 10;

    //ignore punctuation, spaces and capitalisation when searching

    function normalise(value) {
        return String(value)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, "");
    }

    //mark selected chapter button

    function markChapter() {
        $("chapter-list")
        .querySelectorAll("button")
        .forEach((button) => {
            button.setAttribute(
                "aria-pressed",
                String(Number(button.value) === chosen)
            );
        });
    }

    //Filter chapter buttons
    function renderChapters() {
        const query = normalise(
            $("chapter-search").value
        );

        const matches = chapters.filter((item) =>
            normalise(
                item.number + " " +
                item.englishName + " " +
                item.englishNameTranslation + " " +
                item.name
            ).includes(query)
        );

        $("chapter-list").replaceChildren();

        $("chapter-status").textContent = matches.length 
        ? matches.length + " chapters found."
        : "No matching chapters, try another name or number.";

        matches.forEach((item) => {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "chapter-option";
            button.value = item.number;

            const name = document.createElement("span");

            name.textContent =
            item.number + ". " + item.englishName;

            const meaning = document.createElement("small");

            meaning.textContent =
            item.englishNameTranslation;

            button.append(name, meaning);

            button.addEventListener("click", () => {
                chosen = item.number;
                selected = 1;

                markChapter();
                loadChapter();
            });

            $("chapter-list").append(button);
        });

        markChapter();
    }

    async function loadChapters() {
        $("chapter-search").disabled = true;
        $("retry-chapters").hidden = true;

        $("chapter-status").textContent = 
        "Loading chapters.";

        try {
            const data = await request("/surah");

            if (!Array.isArray(data) || !data.length) {
                throw new EmptyResult("No chapters");
            }

            if (
                data.length !== 114 ||
                data.some ((item, index) =>
                    item.number !== index + 1 ||
                !item.name ||
                !item.englishName ||
                !item.englishNameTranslation
                )
            ) {
                throw new Error("Invalid chapter list");
            }

            chapters = data;

            $("chapter-search").disabled = false;

            renderChapters();
        } catch {
            cache.clear();

            $("chapter-status").textContent =
            "The chapter list could not load.";

            $("retry-chapters").hidden = false;
        }
    }
        

    //Verse list
    function renderVerses() {
        $("verse-list").replaceChildren();
        $("verse-list").start = offset + 1;

        const visibleVerses = chapter.verses.slice(
            offset,
            offset + pageSize
        );

        visibleVerses.forEach((verse) => {
            const item = document.createElement("li");

            item.className = "chapter-verse";
            item.id = "verse-" + verse.local;

            if (verse.local === selected) {
                item.classList.add("selected");
            }

            const header = document.createElement("div");
            header.className = "chapter-verse-header";

            const reference = document.createElement("span");

            reference.textContent =
            chapter.number + ":" + verse.local;

            const link = document.createElement("a");

            link.href =
            "discover.html?ayah=" + verse.number;

            link.textContent = "Read and listen";

            link.setAttribute(
                "aria-label",
                "Read and listen to verse " + 
                reference.textContent
            );

            header.append(reference, link);

            const arabic = document.createElement("p");

            arabic.className = "arabic";
            arabic.lang = "ar";
            arabic.dir = "rtl";
            arabic.textContent = verse.arabic;

            const translation = document.createElement("p");

            translation.className = "translation";
            translation.textContent = verse.english;

            item.append(header, arabic, translation);

            $("verse-list").append(item);
        });

        $("reading-range").textContent =
        "Verses " + (offset + 1) + "-" +
        Math.min(
            offset + pageSize,
            chapter.verses.length
        ) +
        " of " + chapter.verses.length;

        $("previous-verses").disabled =
            offset === 0;

        $("next-verses").disabled =
            offset + pageSize >= chapter.verses.length;
        
        if (!$("chapter-result").hidden) {
            animateReading($("verse-list"));

            if (window.ScrollTrigger) {
                window.ScrollTrigger.refresh
            }
        }    
    }

    async function loadChapter() {
        const version = ++requestVersion;
        const number = chosen;

        chapter = null;

        showState("loading");

        try {
            const { arabic, english } = await editions(
                "/surah/" + number
            );

            if (version !== requestVersion) return;

            if (
                arabic.number !== number ||
                english.number !== number ||
                !Array.isArray(arabic.ayahs) ||
                !Array.isArray(english.ayahs)
            ) {
                throw new Error ("Invalid chapter");
            }

            if (
                !arabic.ayahs.length ||
                !english.ayahs.length
            ) {
                throw new EmptyResult("No verses");
            }

            if (
                arabic.ayahs.length !== english.ayahs.length ||
                arabic.ayahs.length !== arabic.numberOfAyahs ||
                !arabic.name ||
                !arabic.englishName
            ) {
                throw new Error("Incomplete chapter");
            }

            const translations = new Map(
                english.ayahs.map((verse) => [
                    verse.number,
                    verse
                ])
            );

            const verses = arabic.ayahs.map((verse) =>
                matchVerse(
                    verse,
                    translations.get(verse.number)
                )
            );

            if (
                verses.some((verse, index) =>
                    verse.local !== index + 1
                )
            ) {
                throw new Error("incorrect verse order");
            }

            chapter = { ...arabic, verses };

            selected = validNumber(
                selected, 
                verses.length,
                1
            );

            offset =
            Math.floor(
                (selected - 1) / pageSize
            ) * pageSize;

            $("chapter-title").textContent =
            chapter.englishName;

            $("chapter-meaning").textContent =
            chapter.englishNameTranslation;

            $("chapter-arabic").textContent =
            chapter.name;

            $("chapter-meta").textContent =
            "SURAH " + chapter.number +
            " / " + verses.length + "VERSES";

            $("jump-verse").max = verses.length;
            $("jump-verse").value = selected;

            $("back-discovery").href =
            "discover.html?ayah=" +
            verses[selected - 1].number;

            updateURL({
                surah: number,
                ayah: selected
            });

            renderVerses();
            showState("success");
        } catch (error) {
            if (version === requestVersion) {
                cache.clear();
                showError(error);
            }
        }
    }

    //Moving keyboard focus and veiwport to the new reading
    function focusReading(element) {
        element.tabIndex = -1;

        element.focus({
            preventScroll: true
        });

        element.scrollIntoView({
            block: "start",
            behavior: "instant"
        });
    }

    //Filtering the sidebar as users type
    $("chapter-search").addEventListener(
        "input",
        renderChapters
    );

    //Retry loading the sidebar
    $("retry-chapters").addEventListener(
        "click",
        loadChapters
    );

    //Retry loading the selected chapter
    $("retry").addEventListener(
        "click",
        loadChapter
    );

    //Show the previous group of verses
    $("previous-verses").addEventListener("click", () => {
        if (!chapter) return;

        offset = Math.max(
            0,
            offset - pageSize
        );

        renderVerses();
        focusReading($("verse-list"));
    });

    //Show the next group of verses
    $("next-verses").addEventListener("click", () => {
        if (
            !chapter ||
            offset + pageSize >= chapter.verses.length
        ) {
            return;
        }

        offset += pageSize;

        renderVerses();
        focusReading($("verse-list"));
    });

    //connecting "go to verse"

    $("jump-form").addEventListener("submit", (event) => {
        event.preventDefault();

        if (
            !chapter ||
            !$("jump-form").reportValidity()
        ) {
            return;
        }

        selected = validNumber(
            $("jump-verse").value,
            chapter.verses.length,
            1
        );

        offset =
        Math.floor(
            (selected -1) / pageSize
        ) * pageSize;

        updateURL({
            surah: chapter.number,
            ayah: selected
        });

        $("back-discovery").href =
        "discover.html?ayah=" +
        chapter.verses[selected -1].number;

        renderVerses();

        focusReading(
            $("verse-" + selected)
        );
    });

    //Text sizing
    function changeSize(amount) {
        scale = Math.max(
            0.9,
            Math.min(
                1.4,
                Math.round(
                    (scale + amount) * 10
                ) / 10
            )
        );

        document.documentElement.style.setProperty(
            "--read-scale",
            scale
        );

        $("text-smaller").disabled =
        scale <= 0.9;

        $("text-larger").disabled =
        scale >= 1.4;
    }

    $("text-smaller").addEventListener("click", () => {
        changeSize(-0.1);
    });

    $("text-larger").addEventListener("click", () =>{
        changeSize(0.1);
    });

    //load sidebar and selected chapter once explore page is opened
    loadChapters();
    loadChapter();
}

/* START CORRECT PAGE */

try {
    startMotion();
} catch (error) {
    console.warn("Animations unavailable.", error);
}

if (page === "discover") {
    startDiscover();
}

if (page === "explore") {
    startExplore();
}

})();



    