// Load policy data and initialize application
fetch('data/policy-data.json')
    .then(response => response.json())
    .then(rawData => {
        initializeApp(rawData);
    })
    .catch(error => {
        console.error('Error loading policy data:', error);
    });

function initializeApp(rawData) {
        const policyData = rawData.countries;
        const allianceData = rawData.alliances;
        const countrySummaries = rawData.countrySummaries || {};
        const similarityMatrix = rawData.similarityMatrix || {};
        const directionalCoding = rawData.directionalCoding || {};
        const allianceConvergence = rawData.allianceConvergence || {};
        const highPolicyConvergence = rawData.highPolicyConvergence || {};
        const MAX_COMPARE = 2;

        // Voting stance data for key UN resolutions on LAWS/military AI
        // Countries that voted AGAINST key resolutions - drastic divergence from consensus
        const votedAgainstResolutions = {
            'Russian Federation': { year: 2023, resolutions: ['A/RES/78/241', 'A/RES/79/239'] },
            'Russia': { year: 2023, resolutions: ['A/RES/78/241', 'A/RES/79/239'] },
            'North Korea': { year: 2024, resolutions: ['L.77'] },
            'India': { year: 2023, resolutions: ['A/RES/78/241'] }
        };
        
        // Countries that ABSTAINED - moderate divergence from consensus
        const abstainedResolutions = {
            'China': { year: 2023, resolutions: ['A/RES/78/241'] },
            'Czech Republic': { year: 2024, resolutions: ['L.77'] },
            'Czechia': { year: 2024, resolutions: ['L.77'] },
            'Estonia': { year: 2024, resolutions: ['L.77'] },
            'Iran': { year: 2023, resolutions: ['A/RES/78/241', 'L.77'] },
            'Israel': { year: 2023, resolutions: ['A/RES/78/241', 'L.77'] },
            'Latvia': { year: 2024, resolutions: ['L.77'] },
            'Lithuania': { year: 2024, resolutions: ['L.77'] },
            'Poland': { year: 2024, resolutions: ['L.77'] },
            'Turkey': { year: 2023, resolutions: ['A/RES/78/241', 'L.77'] },
            'Türkiye': { year: 2023, resolutions: ['A/RES/78/241', 'L.77'] },
            'United Arab Emirates': { year: 2023, resolutions: ['A/RES/78/241'] },
            'Ukraine': { year: 2024, resolutions: ['L.77'] }
        };
        
        // Calculate voting stance divergence penalty (or bonus for agreement)
        function calcVotingDivergencePenalty(country1, country2, year) {
            var c1Against = votedAgainstResolutions[country1];
            var c2Against = votedAgainstResolutions[country2];
            var c1Abstain = abstainedResolutions[country1];
            var c2Abstain = abstainedResolutions[country2];
            
            // Check if voting data applies to this year
            var c1VotedAgainst = c1Against && year >= c1Against.year;
            var c2VotedAgainst = c2Against && year >= c2Against.year;
            var c1Abstained = c1Abstain && year >= c1Abstain.year;
            var c2Abstained = c2Abstain && year >= c2Abstain.year;
            
            // Determine each country's stance: 'against', 'abstain', or 'for'
            var stance1 = c1VotedAgainst ? 'against' : (c1Abstained ? 'abstain' : 'for');
            var stance2 = c2VotedAgainst ? 'against' : (c2Abstained ? 'abstain' : 'for');
            
            // Same stance = convergence (negative penalty = bonus)
            if (stance1 === stance2) {
                if (stance1 === 'against') return -0.05; // Both against = strong agreement
                if (stance1 === 'abstain') return -0.03; // Both abstain = agreement in hesitance
                return 0; // Both for = baseline, no adjustment
            }
            
            // Different stances = divergence
            if (stance1 === 'against' || stance2 === 'against') {
                // One voted against
                if (stance1 === 'abstain' || stance2 === 'abstain') {
                    return 0.20; // Against vs Abstain - moderate divergence (both skeptical, different degrees)
                }
                return 0.35; // Against vs For - major divergence
            }
            
            // One abstained, one voted for
            return 0.15; // Abstain vs For - moderate divergence
        }


        const countryNameMap = {
            "United States of America": "USA",
            "United States": "USA",
            "China": "China",
            "France": "France",
            "United Kingdom": "UK",
            "UK": "UK",
            "South Korea": "South Korea",
            "Korea, Republic of": "South Korea",
            "Republic of Korea": "South Korea",
            "Israel": "Israel",
            "Russia": "Russia",
            "Russian Federation": "Russia",
            "Estonia": "Estonia",
            "Australia": "Australia",
            "Germany": "Germany",
            "Turkey": "Turkey",
            "Türkiye": "Turkey",
            "India": "India",
            "Pakistan": "Pakistan",
            "Azerbaijan": "Azerbaijan",
            "Ukraine": "Ukraine",
            "United Arab Emirates": "UAE",
            "Iran": "Iran",
            "Iran, Islamic Republic of": "Iran",
            "North Korea": "North Korea",
            "Korea, Democratic People's Republic of": "North Korea",
            "Dem. Rep. Korea": "North Korea",
            "Democratic People's Republic of Korea": "North Korea",
            "Norway": "Norway",
            "Singapore": "Singapore",
            "Japan": "Japan",
            "Canada": "Canada",
            "Poland": "Poland",
            "Belgium": "Belgium",
            "Egypt": "Egypt",
            "Italy": "Italy",
            "Algeria": "Algeria",
            "Armenia": "Armenia",
            "Colombia": "Colombia",
            "Netherlands": "Netherlands",
            "Spain": "Spain",
            "Iraq": "Iraq",
            "Lithuania": "Lithuania",
            "Greece": "Greece",
            "Sweden": "Sweden",
            "Latvia": "Latvia",
            "Finland": "Finland",
            "Denmark": "Denmark",
            "Hungary": "Hungary",
            "Croatia": "Croatia",
            "Morocco": "Morocco",
            "Czechia": "Czechia",
            "Czech Republic": "Czechia",
            "Bulgaria": "Bulgaria",
            "Brazil": "Brazil",
            "South Africa": "South Africa",
            "S. Africa": "South Africa"
        };


        // Alliance member countries (map names -> our keys, for highlighting)
        const allianceMembers = {
            "NATO": [
                "USA", "UK", "France", "Germany", "Turkey", "Estonia", "Norway",
                "Canada", "Belgium", "Bulgaria", "Croatia", "Czechia", "Denmark",
                "Finland", "Greece", "Hungary", "Iceland", "Italy", "Latvia",
                "Lithuania", "Luxembourg", "Montenegro", "Netherlands", "North Macedonia",
                "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain",
                "Sweden", "Albania"
            ],
            "AUKUS": ["USA", "UK", "Australia"],
            "FVEY": ["USA", "UK", "Australia", "Canada", "New Zealand"]
        };


        // Map from TopoJSON names to alliance member names
        const allianceMemberMap = {
            "United States of America": "USA",
            "United States": "USA",
            "United Kingdom": "UK",
            "U.K.": "UK",
            "Britain": "UK",
            "Great Britain": "UK",
            "France": "France",
            "Germany": "Germany",
            "Turkey": "Turkey",
            "Türkiye": "Turkey",
            "Türkiye": "Turkey",
            "Estonia": "Estonia",
            "Norway": "Norway",
            "Canada": "Canada",
            "Belgium": "Belgium",
            "Bulgaria": "Bulgaria",
            "Croatia": "Croatia",
            "Czechia": "Czechia",
            "Czech Republic": "Czechia",
            "Czech Rep.": "Czechia",
            "Denmark": "Denmark",
            "Finland": "Finland",
            "Greece": "Greece",
            "Hungary": "Hungary",
            "Iceland": "Iceland",
            "Italy": "Italy",
            "Latvia": "Latvia",
            "Lithuania": "Lithuania",
            "Luxembourg": "Luxembourg",
            "Montenegro": "Montenegro",
            "Netherlands": "Netherlands",
            "North Macedonia": "North Macedonia",
            "Macedonia": "North Macedonia",
            "Poland": "Poland",
            "Portugal": "Portugal",
            "Romania": "Romania",
            "Slovakia": "Slovakia",
            "Slovenia": "Slovenia",
            "Spain": "Spain",
            "Sweden": "Sweden",
            "Albania": "Albania",
            "Australia": "Australia",
            "New Zealand": "New Zealand",
            "Japan": "Japan",
            "Greenland": "Greenland",
            "Republic of Albania": "Albania",
            "Kingdom of Belgium": "Belgium",
            "Republic of Bulgaria": "Bulgaria",
            "Republic of Croatia": "Croatia",
            "Kingdom of Denmark": "Denmark",
            "Republic of Estonia": "Estonia",
            "Republic of Finland": "Finland",
            "French Republic": "France",
            "Federal Republic of Germany": "Germany",
            "Hellenic Republic": "Greece",
            "Republic of Hungary": "Hungary",
            "Republic of Iceland": "Iceland",
            "Italian Republic": "Italy",
            "Republic of Latvia": "Latvia",
            "Republic of Lithuania": "Lithuania",
            "Grand Duchy of Luxembourg": "Luxembourg",
            "Kingdom of the Netherlands": "Netherlands",
            "Kingdom of Norway": "Norway",
            "Republic of Poland": "Poland",
            "Portuguese Republic": "Portugal",
            "Romania": "Romania",
            "Slovak Republic": "Slovakia",
            "Republic of Slovenia": "Slovenia",
            "Kingdom of Spain": "Spain",
            "Kingdom of Sweden": "Sweden",
            "Republic of Turkey": "Turkey",
            "Republic of Türkiye": "Turkey",
            "Commonwealth of Australia": "Australia",
            "Dominion of Canada": "Canada"
        };


        const displayNames = {
            "USA": "United States of America",
            "China": "China",
            "France": "France",
            "UK": "United Kingdom",
            "South Korea": "Republic of Korea",
            "Israel": "Israel",
            "Russia": "Russian Federation",
            "Estonia": "Estonia",
            "Australia": "Australia",
            "Germany": "Germany",
            "Turkey": "Türkiye",
            "India": "India",
            "Pakistan": "Pakistan",
            "Azerbaijan": "Azerbaijan",
            "Ukraine": "Ukraine",
            "UAE": "United Arab Emirates",
            "Iran": "Iran",
            "North Korea": "Democratic People's Republic of Korea",
            "Norway": "Norway",
            "Singapore": "Singapore",
            "Japan": "Japan",
            "Canada": "Canada",
            "Poland": "Poland",
            "Belgium": "Belgium",
            "Egypt": "Egypt",
            "Italy": "Italy",
            "Algeria": "Algeria",
            "Armenia": "Armenia",
            "Colombia": "Colombia",
            "Netherlands": "Netherlands",
            "Spain": "Spain",
            "Iraq": "Iraq",
            "Lithuania": "Lithuania",
            "Greece": "Greece",
            "Sweden": "Sweden",
            "Latvia": "Latvia",
            "Finland": "Finland",
            "Denmark": "Denmark",
            "Hungary": "Hungary",
            "Croatia": "Croatia",
            "Morocco": "Morocco",
            "Czechia": "Czechia",
            "Czech Republic": "Czechia",
            "Bulgaria": "Bulgaria",
            "Brazil": "Brazil",
            "South Africa": "South Africa",
            "S. Africa": "South Africa"
        };


        let currentView = "overview";
        let selectedCountry = null;
        let selectedAlliance = null;
        let selectedCountries = new Set();
        let selectedPolicyArea = "all";
        let mapZoom = null;
        const tooltip = document.getElementById("tooltip");


        function escapeHtml(text) {
            const div = document.createElement("div");
            div.textContent = text;
            return div.innerHTML.replace(/"/g, '&quot;');
        }


        function extractUrl(text) {
            var urlRegex = /(https?:\/\/[^\s\)]+)/g;
            var match = text.match(urlRegex);
            return match ? match[0].replace(/[.,;:]+$/, '') : null;
        }


        function extractDate(text) {
            // Match patterns like (Jan 2023), (December 2024), (2019), etc.
            var dateRegex = /\(([A-Z][a-z]+ \d{4}|\d{4})\)\s*$/;
            var title = text.split("\n")[0].trim();
            var match = title.match(dateRegex);
            return match ? match[1] : null;
        }


        function parseTitleWithoutDate(text) {
            var title = text.split("\n")[0].trim();
            // Remove the date in parentheses from the end
            return title.replace(/\s*\([A-Z][a-z]+ \d{4}\)\s*$/, '').replace(/\s*\(\d{4}\)\s*$/, '').trim();
        }


        function parseTitle(text) {
            return text.split("\n")[0].trim();
        }


        // ===== CONTENT STATE MANAGEMENT =====
        var currentContentType = "placeholder"; // "placeholder", "country", "policyArea", "keyword"
        
        function resetToPlaceholder() {
            currentContentType = "placeholder";
            selectedCountry = null;
            
            // Reset dropdowns
            document.getElementById("overview-dropdown").value = "";
            document.getElementById("policy-area-filter").value = "";
            document.getElementById("keyword-search").value = "";
            
            // Hide header
            document.getElementById("overview-header").style.display = "none";
            
            // Show placeholder
            document.getElementById("overview-content").innerHTML = 
                '<div class="placeholder" id="overview-placeholder">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">' +
                        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />' +
                    '</svg>' +
                    '<p>Select a country, policy area, or search by keyword<br>to explore defense AI policy frameworks</p>' +
                '</div>';
            
            // Clear map selection
            if (typeof d3 !== 'undefined') {
                d3.selectAll(".country-path").classed("selected", false);
            }
        }
        
        function setContentHeader(title, subtitle, showFilters, showClearBtn) {
            document.getElementById("overview-header").style.display = "flex";
            document.getElementById("overview-title").textContent = title;
            document.getElementById("overview-subtitle").textContent = subtitle;
            document.getElementById("overview-filters").style.display = showFilters ? "flex" : "none";
            document.getElementById("content-clear-btn").style.display = showClearBtn ? "inline-block" : "none";
        }
        
        function initClearButton() {
            var clearBtn = document.getElementById("content-clear-btn");
            if (clearBtn) {
                clearBtn.addEventListener("click", resetToPlaceholder);
            }
        }


        function parseDetails(text) {
            var lines = text.split("\n").slice(1).join("\n").trim();
            var paragraphs = lines.split("\n").filter(function(l) { return l.trim(); });
            return paragraphs.map(function(line) {
                var cleaned = line.replace(/^-\s*/, "").trim().replace(/(https?:\/\/[^\s\)]+)/g, "").trim();
                return cleaned ? "<p>" + escapeHtml(cleaned) + "</p>" : "";
            }).filter(function(p) { return p; }).join("");
        }


        // ===== VIEW SWITCHING =====
        document.querySelectorAll(".explore-tab").forEach(function(tab) {
            tab.addEventListener("click", function() {
                currentView = this.dataset.view;
                document.querySelectorAll(".explore-tab").forEach(function(t) {
                    t.classList.remove("active");
                    t.setAttribute("aria-selected", "false");
                });
                this.classList.add("active");
                this.setAttribute("aria-selected", "true");
                document.querySelectorAll(".view-content").forEach(function(v) { v.classList.remove("active"); });
                document.getElementById("view-" + currentView).classList.add("active");
                
                // Clear alliance highlighting and selection when leaving alliance view
                if (currentView !== "alliance") {
                    selectedAlliance = null;
                    document.querySelectorAll(".country-path").forEach(function(p) {
                        p.classList.remove("alliance-member");
                    });
                    // Hide convergence timeline
                    var convergenceContainer = document.getElementById("convergence-timeline-container");
                    if (convergenceContainer) convergenceContainer.style.display = "none";
                }
                
                updateMapHighlights();
                updateCompareChipsState();
                
                // Re-render momentum chart when analytics tab becomes visible
                // (offsetWidth is 0 while tab is display:none, causing square render)
                if (currentView === "analytics") {
                    renderMomentumChart();
                    renderPolicyGrowthChart();
                }
            });
        });

        // Keyboard navigation for explore tabs
        document.querySelector('.explore-tabs').addEventListener('keydown', function(e) {
            var tabs = Array.from(document.querySelectorAll('.explore-tab'));
            var current = tabs.indexOf(document.activeElement);
            if (current === -1) return;
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                var next = e.key === 'ArrowRight' ? (current + 1) % tabs.length : (current - 1 + tabs.length) % tabs.length;
                tabs[next].focus();
                tabs[next].click();
            }
        });

        // Compact header nav pills → scroll to section + activate tab
        document.querySelectorAll(".hc-nav-pill").forEach(function(pill) {
            pill.addEventListener("click", function() {
                var view = this.dataset.view;
                // Click the matching explore tab
                var matchingTab = document.querySelector('.explore-tab[data-view="' + view + '"]');
                if (matchingTab) matchingTab.click();
                // Scroll to the explore section
                var sectionDivider = document.querySelector('.section-divider');
                if (sectionDivider) {
                    sectionDivider.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                // Update pill active states
                document.querySelectorAll(".hc-nav-pill").forEach(function(p) { p.classList.remove("active"); });
                this.classList.add("active");
            });
        });

        // Keep header pills in sync when explore tabs are clicked directly
        document.querySelectorAll(".explore-tab").forEach(function(tab) {
            tab.addEventListener("click", function() {
                var view = this.dataset.view;
                document.querySelectorAll(".hc-nav-pill").forEach(function(p) { p.classList.remove("active"); });
                var matchingPill = document.querySelector('.hc-nav-pill[data-view="' + view + '"]');
                if (matchingPill) matchingPill.classList.add("active");
            });
        });


        // ===== BUILD CHIPS =====
        function buildDropdowns() {
            var overviewDropdown = document.getElementById("overview-dropdown");
            var compareDropdown = document.getElementById("compare-dropdown");
            
            // Get all countries and sort alphabetically by display name
            var countries = Object.keys(policyData);
            countries.sort(function(a, b) {
                var nameA = displayNames[a] || a;
                var nameB = displayNames[b] || b;
                return nameA.localeCompare(nameB);
            });


            countries.forEach(function(country) {
                var displayName = displayNames[country] || country;


                var option1 = document.createElement("option");
                option1.value = country;
                option1.textContent = displayName;
                overviewDropdown.appendChild(option1);
                
                var option2 = document.createElement("option");
                option2.value = country;
                option2.textContent = displayName;
                compareDropdown.appendChild(option2);
            });


            // Add event listeners
            overviewDropdown.addEventListener("change", function() {
                if (this.value) {
                    selectOverviewCountry(this.value, true); // Skip scroll for dropdown
                } else {
                    // Clear selection when "Choose a country" is selected
                    resetToPlaceholder();
                }
            });


            compareDropdown.addEventListener("change", function() {
                if (this.value && !selectedCountries.has(this.value) && selectedCountries.size < MAX_COMPARE) {
                    toggleCompareCountry(this.value);
                    this.value = ""; // Reset dropdown
                }
            });
        }


        
        // ===== COUNTRY SEARCH =====
        function initCountrySearch() {
            // Get all country names for searching
            var countryList = Object.keys(policyData).map(function(key) {
                return {
                    key: key,
                    displayName: displayNames[key] || key
                };
            });
            
            // Setup search for compare
            setupSearch(
                document.getElementById("compare-search"),
                document.getElementById("compare-search-results"),
                document.getElementById("compare-search-message"),
                countryList,
                function(country) {
                    if (!selectedCountries.has(country.key) && selectedCountries.size < MAX_COMPARE) {
                        toggleCompareCountry(country.key);
                    }
                }
            );
        }
        
        function setupSearch(searchInput, resultsDropdown, searchMessage, countryList, onSelect) {
            if (!searchInput) return;
            
            function performSearch(query) {
                query = query.trim().toLowerCase();
                
                // Hide both dropdowns initially
                resultsDropdown.classList.remove("visible");
                searchMessage.classList.remove("visible");
                resultsDropdown.innerHTML = "";
                
                if (query.length === 0) {
                    return;
                }
                
                // Find matches
                var matches = countryList.filter(function(country) {
                    return country.displayName.toLowerCase().includes(query) ||
                           country.key.toLowerCase().includes(query);
                });
                
                if (matches.length === 0) {
                    // No matches found
                    searchMessage.textContent = "Sorry, your search does not match any entries";
                    searchMessage.classList.add("visible");
                } else if (matches.length === 1) {
                    // Single match - auto-select
                    onSelect(matches[0]);
                    searchInput.value = "";
                } else {
                    // Multiple matches - show dropdown
                    matches.forEach(function(country) {
                        var item = document.createElement("div");
                        item.className = "search-result-item";
                        item.textContent = country.displayName;
                        item.addEventListener("click", function() {
                            onSelect(country);
                            searchInput.value = "";
                            resultsDropdown.classList.remove("visible");
                        });
                        resultsDropdown.appendChild(item);
                    });
                    resultsDropdown.classList.add("visible");
                }
            }
            
            // Debounce search
            var searchTimeout;
            searchInput.addEventListener("input", function() {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(function() {
                    performSearch(searchInput.value);
                }, 150);
            });
            
            // Handle Enter key
            searchInput.addEventListener("keydown", function(e) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    clearTimeout(searchTimeout);
                    performSearch(searchInput.value);
                }
            });
            
            // Close dropdown when clicking outside
            document.addEventListener("click", function(e) {
                if (!e.target.closest(".country-search-wrapper")) {
                    resultsDropdown.classList.remove("visible");
                    searchMessage.classList.remove("visible");
                }
            });
            
            // Close dropdown on escape
            searchInput.addEventListener("keydown", function(e) {
                if (e.key === "Escape") {
                    resultsDropdown.classList.remove("visible");
                    searchMessage.classList.remove("visible");
                    searchInput.blur();
                }
            });
        }


        function updateCompareChipsState() {
            var atLimit = selectedCountries.size >= MAX_COMPARE;
            var dropdown = document.getElementById("compare-dropdown");
            dropdown.disabled = atLimit;


            // Update selected countries display
            var container = document.getElementById("selected-countries");
            container.innerHTML = "";
            
            selectedCountries.forEach(function(country) {
                var tag = document.createElement("div");
                tag.className = "selected-tag";
                tag.innerHTML = '<span>' + escapeHtml(displayNames[country] || country) + '</span>' +
                    '<button class="remove-btn" data-country="' + country + '">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
                    '</button>';
                tag.querySelector(".remove-btn").addEventListener("click", function() {
                    toggleCompareCountry(this.dataset.country);
                });
                container.appendChild(tag);
            });


            var limitText = document.getElementById("selection-limit");
            if (selectedCountries.size > 0) {
                limitText.textContent = "(" + selectedCountries.size + "/" + MAX_COMPARE + " selected)";
            } else {
                limitText.textContent = "(max " + MAX_COMPARE + ")";
            }
        }


        // ===== OVERVIEW FUNCTIONS =====
        function selectOverviewCountry(country, skipScroll) {
            selectedCountry = country;
            currentContentType = "country";
            
            // Clear other selections
            document.getElementById("policy-area-filter").value = "";
            document.getElementById("keyword-search").value = "";
            
            document.getElementById("overview-dropdown").value = country;
            updateMapHighlights();
            renderOverview();
            
            // Smooth scroll to overview section unless skipScroll is true
            if (!skipScroll) {
                var overviewSection = document.getElementById("view-overview");
                if (overviewSection) {
                    setTimeout(function() {
                        overviewSection.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start'
                        });
                    }, 100);
                }
            }
        }


        // ===== ALLIANCE FUNCTIONS =====
        function selectAlliance(alliance) {
            selectedAlliance = alliance;
            document.getElementById("alliance-dropdown").value = alliance;
            updateMapHighlights();
            renderAllianceOverview();
        }


        function switchToCountryOverview(countryKey) {
            // Switch to Country Overview tab
            currentView = "overview";
            
            // Update tab buttons
            document.querySelectorAll(".explore-tab").forEach(function(t) { 
                t.classList.remove("active");
                t.setAttribute("aria-selected", "false");
            });
            var overviewTab = document.querySelector('.explore-tab[data-view="overview"]');
            overviewTab.classList.add("active");
            overviewTab.setAttribute("aria-selected", "true");
            
            // Update view content
            document.querySelectorAll(".view-content").forEach(function(v) { 
                v.classList.remove("active"); 
            });
            document.getElementById("view-overview").classList.add("active");
            
            // Select the country
            selectOverviewCountry(countryKey);
        }


        function getAllianceFilters() {
            return {
                legal: document.getElementById("alliance-filter-legal").checked,
                policy: document.getElementById("alliance-filter-policy").checked,
                statement: document.getElementById("alliance-filter-statement").checked
            };
        }


        function renderAllianceOverview() {
            if (!selectedAlliance) return;


            var data = allianceData[selectedAlliance];
            if (!data) return;


            var allianceNames = {
                "NATO": "North Atlantic Treaty Organization (NATO)",
                "AUKUS": "AUKUS (Australia, UK, US)",
                "FVEY": "Five Eyes (FVEY)"
            };


            var displayName = allianceNames[selectedAlliance] || selectedAlliance;
            document.getElementById("alliance-header").style.display = "flex";
            document.getElementById("alliance-name").textContent = displayName;


            // Render member countries list
            var membersListContainer = document.getElementById("alliance-members-list");
            membersListContainer.style.display = "block";
            membersListContainer.innerHTML = "";
            
            var membersLabel = document.createElement("div");
            membersLabel.className = "alliance-members-label";
            membersLabel.textContent = "Member States";
            membersListContainer.appendChild(membersLabel);
            
            var membersChips = document.createElement("div");
            membersChips.className = "alliance-members-chips";
            
            var members = allianceMembers[selectedAlliance] || [];
            members.sort().forEach(function(member) {
                var chip = document.createElement("span");
                chip.className = "alliance-member-chip";
                chip.textContent = displayNames[member] || member;
                
                // Check if we have data for this country
                if (policyData[member]) {
                    chip.classList.add("has-data");
                    chip.addEventListener("click", function() {
                        // Switch to country overview
                        switchToCountryOverview(member);
                    });
                }
                
                membersChips.appendChild(chip);
            });
            
            membersListContainer.appendChild(membersChips);

            // Render Convergence Timeline
            renderConvergenceTimeline(selectedAlliance);

            var content = document.getElementById("alliance-content");
            content.innerHTML = "";
            
            // Alliance summary blurbs
            var allianceSummaries = {
                "NATO": "NATO has developed a comprehensive AI strategy framework emphasizing principles of responsible use (PRUs) including lawfulness, accountability, explainability, reliability, governability, and bias mitigation. The alliance actively coordinates AI development among member states while ensuring interoperability and shared ethical standards.",
                "AUKUS": "AUKUS is a trilateral security partnership focused on sharing advanced defense capabilities including AI and autonomous systems. Pillar II of the agreement specifically addresses emerging technologies including artificial intelligence, quantum computing, and advanced cyber capabilities.",
                "FVEY": "The Five Eyes intelligence alliance has developed joint guidance on secure AI deployment, focusing on protecting AI systems from adversarial manipulation. However, due to the opaque nature of the alliance, limited public documentation exists regarding specific AI governance frameworks and policies."
            };
            
            // Add summary box
            var allianceSummary = allianceSummaries[selectedAlliance];
            if (allianceSummary) {
                var summaryBox = document.createElement("div");
                summaryBox.className = "country-summary-box";
                summaryBox.textContent = allianceSummary;
                content.appendChild(summaryBox);
            }


            var filters = getAllianceFilters();
            var totalCount = 0;
            var areaCount = 0;


            var POLICY_AREAS = [
                "LAWS Employment/Deployment",
                "Adoption & Intent of Use",
                "Acquisition & Procurement",
                "Ethical Guidelines & Restrictions",
                "Technical Safety & Security Requirements",
                "Int'l Cooperation & Interoperability"
            ];
            
            var AREA_KEYS = ["laws", "adoption", "acquisition", "ethical", "technical", "international"];
            var AREA_COLORS = ["#1a2744", "#d64045", "#6b3074", "#4a9d5b", "#e07020", "#0d7377"];
            var AREA_SHORT = ["LAWS", "Adoption", "Acq.", "Ethics", "Tech.", "Int'l"];


            // ===== CALCULATE MEMBER CONTRIBUTION DATA =====
            var memberContributions = [];
            var memberByArea = {};
            var allianceMembersList = allianceMembers[selectedAlliance] || [];
            
            allianceMembersList.forEach(function(member) {
                if (policyData[member]) {
                    var memberTotal = 0;
                    var areaData = {};
                    
                    POLICY_AREAS.forEach(function(areaName, idx) {
                        var area = policyData[member][areaName];
                        var count = 0;
                        if (area) {
                            count = (area.legal_directives || []).length +
                                   (area.policy_documents || []).length +
                                   (area.public_statements || []).length;
                        }
                        areaData[AREA_KEYS[idx]] = count;
                        memberTotal += count;
                    });
                    
                    if (memberTotal > 0) {
                        memberContributions.push({
                            key: member,
                            name: displayNames[member] || member,
                            total: memberTotal
                        });
                        memberByArea[member] = areaData;
                    }
                }
            });
            
            // Sort by total descending
            memberContributions.sort(function(a, b) { return b.total - a.total; });
            var maxMemberTotal = memberContributions.length > 0 ? memberContributions[0].total : 1;
            
            // Find max heat value for heatmap
            var maxHeatValue = 1;
            Object.keys(memberByArea).forEach(function(member) {
                AREA_KEYS.forEach(function(key) {
                    if (memberByArea[member][key] > maxHeatValue) {
                        maxHeatValue = memberByArea[member][key];
                    }
                });
            });


            // ===== BUILD VISUALIZATIONS =====
            if (memberContributions.length > 0) {
                var insightsRow = document.createElement("div");
                insightsRow.className = "alliance-insights-row";
                
                // ----- Member Contribution Bar Chart -----
                var barChartBox = document.createElement("div");
                barChartBox.className = "alliance-chart-box";
                
                // Header row with title and info icon
                var barHeader = document.createElement("div");
                barHeader.className = "alliance-chart-header";
                
                var barTitle = document.createElement("div");
                barTitle.className = "alliance-chart-title";
                barTitle.textContent = "Member Contributions";
                barHeader.appendChild(barTitle);
                
                var barInfoNote = document.createElement("div");
                barInfoNote.className = "alliance-info-note";
                barInfoNote.innerHTML = '<span class="info-icon">i</span><span>Info</span>' +
                    '<div class="alliance-info-tooltip">Visualizations include only alliance members with individual country profiles in this database. Some member states may not yet be documented.</div>';
                barHeader.appendChild(barInfoNote);
                
                barChartBox.appendChild(barHeader);
                
                var barSubtitle = document.createElement("div");
                barSubtitle.className = "alliance-chart-subtitle";
                barSubtitle.textContent = "Policy entries by member state";
                barChartBox.appendChild(barSubtitle);
                
                var barsContainer = document.createElement("div");
                barsContainer.style.cssText = "display: flex; flex-direction: column; gap: 2px;";
                
                // Show top 10 members initially
                var initialMembers = memberContributions.slice(0, 10);
                var extraMembers = memberContributions.slice(10);
                
                // Function to create a bar row
                function createBarRow(member, idx) {
                    var row = document.createElement("div");
                    row.className = "member-bar-row";
                    
                    var nameSpan = document.createElement("div");
                    nameSpan.className = "member-bar-name";
                    nameSpan.textContent = member.name;
                    nameSpan.title = member.name;
                    row.appendChild(nameSpan);
                    
                    var track = document.createElement("div");
                    track.className = "member-bar-track";
                    
                    var fill = document.createElement("div");
                    fill.className = "member-bar-fill";
                    if (idx < 3) fill.classList.add("rank-1");
                    else if (idx < 6) fill.classList.add("rank-2");
                    else fill.classList.add("rank-3");
                    fill.style.width = ((member.total / maxMemberTotal) * 100) + "%";
                    track.appendChild(fill);
                    row.appendChild(track);
                    
                    var valueSpan = document.createElement("div");
                    valueSpan.className = "member-bar-value";
                    if (idx >= 3) valueSpan.classList.add("muted");
                    valueSpan.textContent = member.total;
                    row.appendChild(valueSpan);
                    
                    row.style.cursor = "pointer";
                    (function(countryKey) {
                        row.addEventListener("click", function() {
                            switchToCountryOverview(countryKey);
                        });
                    })(member.key);
                    
                    return row;
                }
                
                // Add initial members
                initialMembers.forEach(function(member, idx) {
                    barsContainer.appendChild(createBarRow(member, idx));
                });
                
                barChartBox.appendChild(barsContainer);
                
                // Add expandable section for extra members
                if (extraMembers.length > 0) {
                    var extraBarsContainer = document.createElement("div");
                    extraBarsContainer.style.cssText = "display: none; flex-direction: column; gap: 2px; margin-top: 2px;";
                    extraBarsContainer.className = "extra-bars-container";
                    
                    extraMembers.forEach(function(member, idx) {
                        extraBarsContainer.appendChild(createBarRow(member, idx + 10));
                    });
                    
                    barChartBox.appendChild(extraBarsContainer);
                    
                    var expandToggle = document.createElement("div");
                    expandToggle.className = "expand-more-toggle";
                    expandToggle.innerHTML = '<span class="expand-more-text">+' + extraMembers.length + ' more members</span><svg class="expand-more-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg>';
                    
                    var isExpanded = false;
                    expandToggle.addEventListener("click", function() {
                        isExpanded = !isExpanded;
                        extraBarsContainer.style.display = isExpanded ? "flex" : "none";
                        expandToggle.querySelector(".expand-more-text").textContent = isExpanded ? "Show less" : "+" + extraMembers.length + " more members";
                        expandToggle.querySelector(".expand-more-icon").style.transform = isExpanded ? "rotate(180deg)" : "rotate(0)";
                    });
                    
                    barChartBox.appendChild(expandToggle);
                }
                
                insightsRow.appendChild(barChartBox);
                
                // ----- Policy Coverage Heatmap -----
                var heatmapBox = document.createElement("div");
                heatmapBox.className = "alliance-chart-box";
                
                // Header row with title and info icon
                var heatHeader = document.createElement("div");
                heatHeader.className = "alliance-chart-header";
                
                var heatTitle = document.createElement("div");
                heatTitle.className = "alliance-chart-title";
                heatTitle.textContent = "Policy Coverage Heatmap";
                heatHeader.appendChild(heatTitle);
                
                var heatInfoNote = document.createElement("div");
                heatInfoNote.className = "alliance-info-note";
                heatInfoNote.innerHTML = '<span class="info-icon">i</span><span>Info</span>' +
                    '<div class="alliance-info-tooltip">Visualizations include only alliance members with individual country profiles in this database. Some member states may not yet be documented.</div>';
                heatHeader.appendChild(heatInfoNote);
                
                heatmapBox.appendChild(heatHeader);
                
                var heatSubtitle = document.createElement("div");
                heatSubtitle.className = "alliance-chart-subtitle";
                heatSubtitle.textContent = "Entry counts by member and policy area (darker = more)";
                heatmapBox.appendChild(heatSubtitle);
                
                var tableWrapper = document.createElement("div");
                tableWrapper.style.cssText = "overflow-x: auto;";
                
                var table = document.createElement("table");
                table.className = "alliance-heatmap";
                
                // Header row
                var thead = document.createElement("thead");
                var headerRow = document.createElement("tr");
                
                var memberTh = document.createElement("th");
                memberTh.className = "member-col";
                memberTh.textContent = "MEMBER";
                headerRow.appendChild(memberTh);
                
                AREA_SHORT.forEach(function(shortName, idx) {
                    var th = document.createElement("th");
                    th.style.minWidth = "52px";
                    var dot = document.createElement("div");
                    dot.className = "area-dot";
                    dot.style.background = AREA_COLORS[idx];
                    th.appendChild(dot);
                    th.appendChild(document.createTextNode(shortName));
                    headerRow.appendChild(th);
                });
                
                var totalTh = document.createElement("th");
                totalTh.textContent = "TOTAL";
                headerRow.appendChild(totalTh);
                
                thead.appendChild(headerRow);
                table.appendChild(thead);
                
                // Body rows - show top 10 initially, rest in expandable section
                var tbody = document.createElement("tbody");
                var initialHeatmapMembers = memberContributions.slice(0, 10);
                var extraHeatmapMembers = memberContributions.slice(10);
                
                // Function to create a heatmap row
                function createHeatmapRow(member) {
                    var row = document.createElement("tr");
                    
                    var nameTd = document.createElement("td");
                    nameTd.className = "member-name";
                    nameTd.textContent = member.name;
                    nameTd.style.cursor = "pointer";
                    (function(countryKey) {
                        nameTd.addEventListener("click", function() {
                            switchToCountryOverview(countryKey);
                        });
                    })(member.key);
                    row.appendChild(nameTd);
                    
                    AREA_KEYS.forEach(function(key) {
                        var td = document.createElement("td");
                        td.className = "heat-cell";
                        var value = memberByArea[member.key][key] || 0;
                        
                        if (value === 0) {
                            td.classList.add("empty");
                            td.textContent = "—";
                            td.style.background = "#f5f5f5";
                        } else {
                            td.textContent = value;
                            var intensity = value / maxHeatValue;
                            var r = Math.round(245 - (245 - 26) * intensity);
                            var g = Math.round(245 - (245 - 39) * intensity);
                            var b = Math.round(245 - (245 - 68) * intensity);
                            td.style.background = "rgb(" + r + "," + g + "," + b + ")";
                            if (intensity > 0.5) {
                                td.classList.add("high");
                            }
                        }
                        row.appendChild(td);
                    });
                    
                    var totalTd = document.createElement("td");
                    totalTd.className = "total-cell";
                    totalTd.textContent = member.total;
                    row.appendChild(totalTd);
                    
                    return row;
                }
                
                // Add initial members to tbody
                initialHeatmapMembers.forEach(function(member) {
                    tbody.appendChild(createHeatmapRow(member));
                });
                
                table.appendChild(tbody);
                
                // Create expandable tbody for extra members
                var extraTbody = null;
                if (extraHeatmapMembers.length > 0) {
                    extraTbody = document.createElement("tbody");
                    extraTbody.className = "extra-heatmap-rows";
                    extraTbody.style.display = "none";
                    
                    extraHeatmapMembers.forEach(function(member) {
                        extraTbody.appendChild(createHeatmapRow(member));
                    });
                    
                    table.appendChild(extraTbody);
                }
                
                tableWrapper.appendChild(table);
                heatmapBox.appendChild(tableWrapper);
                
                // Add expand toggle for heatmap
                if (extraHeatmapMembers.length > 0) {
                    var heatmapExpandToggle = document.createElement("div");
                    heatmapExpandToggle.className = "expand-more-toggle";
                    heatmapExpandToggle.innerHTML = '<span class="expand-more-text">+' + extraHeatmapMembers.length + ' more members</span><svg class="expand-more-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg>';
                    
                    var heatmapExpanded = false;
                    heatmapExpandToggle.addEventListener("click", function() {
                        heatmapExpanded = !heatmapExpanded;
                        extraTbody.style.display = heatmapExpanded ? "table-row-group" : "none";
                        heatmapExpandToggle.querySelector(".expand-more-text").textContent = heatmapExpanded ? "Show less" : "+" + extraHeatmapMembers.length + " more members";
                        heatmapExpandToggle.querySelector(".expand-more-icon").style.transform = heatmapExpanded ? "rotate(180deg)" : "rotate(0)";
                    });
                    
                    heatmapBox.appendChild(heatmapExpandToggle);
                }
                
                // Legend
                var legend = document.createElement("div");
                legend.className = "heatmap-legend";
                legend.innerHTML = '<span>Coverage:</span>' +
                    '<div class="heatmap-legend-item"><div class="heatmap-legend-swatch" style="background:#f5f5f5"></div><span>None</span></div>' +
                    '<div class="heatmap-legend-item"><div class="heatmap-legend-swatch" style="background:#b8c4d4"></div><span>Low</span></div>' +
                    '<div class="heatmap-legend-item"><div class="heatmap-legend-swatch" style="background:#5a7a9a"></div><span>Med</span></div>' +
                    '<div class="heatmap-legend-item"><div class="heatmap-legend-swatch" style="background:#1a2744"></div><span>High</span></div>';
                heatmapBox.appendChild(legend);
                
                insightsRow.appendChild(heatmapBox);
                content.appendChild(insightsRow);
            }


            // Build policy areas container (same structure as country overview)
            var areasContainer = document.createElement("div");
            areasContainer.className = "policy-areas";


            POLICY_AREAS.forEach(function(areaName) {
                var entries = data[areaName];
                if (!entries) return;


                var filteredEntries = {
                    legal_directives: filters.legal ? (entries.legal_directives || []) : [],
                    policy_documents: filters.policy ? (entries.policy_documents || []) : [],
                    public_statements: filters.statement ? (entries.public_statements || []) : []
                };


                var areaTotal = filteredEntries.legal_directives.length +
                               filteredEntries.policy_documents.length +
                               filteredEntries.public_statements.length;


                if (areaTotal === 0) return;


                areaCount++;
                totalCount += areaTotal;


                var policyArea = document.createElement("div");
                policyArea.className = "policy-area";
                
                // Set data-area attribute for consistent color coding
                if (areaName.indexOf("LAWS") !== -1) policyArea.setAttribute("data-area", "laws");
                else if (areaName.indexOf("Adoption") !== -1) policyArea.setAttribute("data-area", "adoption");
                else if (areaName.indexOf("Acquisition") !== -1) policyArea.setAttribute("data-area", "acquisition");
                else if (areaName.indexOf("International") !== -1) policyArea.setAttribute("data-area", "international");
                else if (areaName.indexOf("Technical") !== -1) policyArea.setAttribute("data-area", "technical");
                else if (areaName.indexOf("Ethical") !== -1) policyArea.setAttribute("data-area", "ethical");


                var areaHeader = document.createElement("div");
                areaHeader.className = "policy-area-header";
                areaHeader.addEventListener("click", function() { policyArea.classList.toggle("expanded"); });


                var areaTitle = document.createElement("span");
                areaTitle.className = "policy-area-title";
                areaTitle.textContent = areaName;
                areaHeader.appendChild(areaTitle);


                var areaMeta = document.createElement("div");
                areaMeta.className = "policy-area-meta";


                var sourceCount = document.createElement("span");
                sourceCount.className = "source-count";
                sourceCount.textContent = areaTotal + " entries";
                areaMeta.appendChild(sourceCount);


                var expandIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                expandIcon.setAttribute("class", "expand-icon");
                expandIcon.setAttribute("viewBox", "0 0 24 24");
                expandIcon.setAttribute("fill", "none");
                expandIcon.setAttribute("stroke", "currentColor");
                var expandPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                expandPath.setAttribute("stroke-linecap", "round");
                expandPath.setAttribute("stroke-linejoin", "round");
                expandPath.setAttribute("stroke-width", "2");
                expandPath.setAttribute("d", "M19 9l-7 7-7-7");
                expandIcon.appendChild(expandPath);
                areaMeta.appendChild(expandIcon);


                areaHeader.appendChild(areaMeta);
                policyArea.appendChild(areaHeader);


                var areaContent = document.createElement("div");
                areaContent.className = "policy-area-content";


                var legalSection = createSourceSection(filteredEntries.legal_directives, "legal", "Legal Directives");
                if (legalSection) areaContent.appendChild(legalSection);


                var policySection = createSourceSection(filteredEntries.policy_documents, "policy", "Policy Documents");
                if (policySection) areaContent.appendChild(policySection);
                                
                var statementSection = createSourceSection(filteredEntries.public_statements, "statement", "Public Statements");
                if (statementSection) areaContent.appendChild(statementSection);


                policyArea.appendChild(areaContent);
                areasContainer.appendChild(policyArea);
            });


            // Add section title for alliance-specific policies
            if (areasContainer.children.length > 0) {
                var policySectionTitle = document.createElement("div");
                policySectionTitle.style.cssText = "font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 0.95rem; color: var(--navy); margin-bottom: 16px;";
                policySectionTitle.textContent = "Alliance-Level Policies";
                content.appendChild(policySectionTitle);
            }


            document.getElementById("alliance-subtitle").textContent = totalCount + " alliance entries • " + memberContributions.length + " members with policy data";
            content.appendChild(areasContainer);
        }


        // Alliance filter event listeners
        ["alliance-filter-legal", "alliance-filter-policy", "alliance-filter-statement"].forEach(function(id) {
            document.getElementById(id).addEventListener("change", renderAllianceOverview);
        });


        // Alliance dropdown event listener
        document.getElementById("alliance-dropdown").addEventListener("change", function() {
            if (this.value) {
                selectAlliance(this.value);
            } else {
                // Clear selection when "Choose an alliance" is selected
                selectedAlliance = null;
                document.getElementById("alliance-header").style.display = "none";
                document.getElementById("alliance-members-list").style.display = "none";
                document.getElementById("alliance-content").innerHTML = '<div class="placeholder"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p>Select an alliance to explore combined<br>defense AI policies of member states</p></div>';
                // Clear map highlighting
                d3.selectAll(".country-path").classed("alliance-member", false);
            }
        });


        function getActiveFilters() {
            return {
                legal: document.getElementById("filter-legal").checked,
                policy: document.getElementById("filter-policy").checked,
                                statement: document.getElementById("filter-statement").checked
            };
        }


        function createSourceItem(entry) {
            var text = entry.text || entry;
            var url = entry.url || null;
            
            var item = document.createElement("div");
            item.className = "source-item";


            var itemHeader = document.createElement("div");
            itemHeader.className = "source-item-header";


            var titleRow = document.createElement("div");
            titleRow.className = "source-item-title-row";


            var title = document.createElement("span");
            title.className = "source-item-title";
            title.textContent = parseTitleWithoutDate(text);
            titleRow.appendChild(title);


            var dateStr = extractDate(text);
            if (dateStr) {
                var dateBadge = document.createElement("span");
                dateBadge.className = "source-item-date";
                dateBadge.textContent = dateStr;
                titleRow.appendChild(dateBadge);
            }


            if (url) {
                var link = document.createElement("button");
                link.className = "source-link";
                link.type = "button";
                link.title = "Open source document";
                link.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>';
                (function(targetUrl) {
                    link.addEventListener("click", function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        window.open(targetUrl, "_blank");
                    });
                })(url);
                titleRow.appendChild(link);
            }


            itemHeader.appendChild(titleRow);


            var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            icon.setAttribute("class", "source-item-expand");
            icon.setAttribute("viewBox", "0 0 24 24");
            icon.setAttribute("fill", "none");
            icon.setAttribute("stroke", "currentColor");
            var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("stroke-linecap", "round");
            path.setAttribute("stroke-linejoin", "round");
            path.setAttribute("stroke-width", "2");
            path.setAttribute("d", "M19 9l-7 7-7-7");
            icon.appendChild(path);
            itemHeader.appendChild(icon);


            itemHeader.addEventListener("click", function(e) { 
                if (e.target.closest(".source-link")) return;
                item.classList.toggle("expanded"); 
            });
            item.appendChild(itemHeader);


            var details = document.createElement("div");
            details.className = "source-item-details";
            details.innerHTML = parseDetails(text);
            item.appendChild(details);


            return item;
        }


        function createSourceSection(entries, type, label) {
            if (entries.length === 0) return null;


            var section = document.createElement("div");
            section.className = "source-section";


            var header = document.createElement("div");
            header.className = "source-type-header " + type;
            header.textContent = label + " (" + entries.length + ")";
            section.appendChild(header);


            var items = document.createElement("div");
            items.className = "source-items";
            entries.forEach(function(entry) { items.appendChild(createSourceItem(entry)); });
            section.appendChild(items);


            return section;
        }


        function renderOverview() {
            if (!selectedCountry) return;


            var data = policyData[selectedCountry];
            var filters = getActiveFilters();
            var displayName = displayNames[selectedCountry] || selectedCountry;
            var summary = rawData.summaries ? rawData.summaries[selectedCountry] : null;


            document.getElementById("overview-header").style.display = "flex";
            document.getElementById("overview-title").textContent = displayName;
            document.getElementById("overview-filters").style.display = "flex";
            document.getElementById("content-clear-btn").style.display = "none";


            // Calculate totals and area distribution for pie chart
            var totalCount = 0;
            var areaDistribution = [];
            var legalCount = 0, policyCount = 0, statementCount = 0;


            var policyAreaNames = [
                "LAWS Employment/Deployment",
                "Adoption & Intent of Use",
                "Acquisition & Procurement",
                "Int'l Cooperation & Interoperability",
                "Technical Safety & Security Requirements",
                "Ethical Guidelines & Restrictions"
            ];


            var pieColors = ["#1a2744", "#d64045", "#6b3074", "#0d7377", "#e07020", "#4a9d5b"];


            policyAreaNames.forEach(function(areaName, idx) {
                var entries = data[areaName];
                if (!entries) return;
                
                var areaLegal = filters.legal ? entries.legal_directives.length : 0;
                var areaPolicy = filters.policy ? entries.policy_documents.length : 0;
                var areaStatement = filters.statement ? entries.public_statements.length : 0;
                var areaTotal = areaLegal + areaPolicy + areaStatement;
                
                if (areaTotal > 0) {
                    areaDistribution.push({
                        name: areaName,
                        count: areaTotal,
                        color: pieColors[idx]
                    });
                    totalCount += areaTotal;
                    legalCount += areaLegal;
                    policyCount += areaPolicy;
                    statementCount += areaStatement;
                }
            });


            // Build policy areas container
            var areasContainer = document.createElement("div");
            areasContainer.className = "policy-areas";


            Object.keys(data).forEach(function(areaName) {
                var entries = data[areaName];
                var filtered = {
                    legal_directives: filters.legal ? entries.legal_directives : [],
                    policy_documents: filters.policy ? entries.policy_documents : [],
                    public_statements: filters.statement ? entries.public_statements : []
                };


                var areaTotal = filtered.legal_directives.length + filtered.policy_documents.length +
                                filtered.public_statements.length;


                if (areaTotal === 0) return;


                var policyArea = document.createElement("div");
                policyArea.className = "policy-area";
                
                // Set data-area attribute for consistent color coding
                if (areaName.indexOf("LAWS") !== -1) policyArea.setAttribute("data-area", "laws");
                else if (areaName.indexOf("Adoption") !== -1) policyArea.setAttribute("data-area", "adoption");
                else if (areaName.indexOf("Acquisition") !== -1) policyArea.setAttribute("data-area", "acquisition");
                else if (areaName.indexOf("International") !== -1) policyArea.setAttribute("data-area", "international");
                else if (areaName.indexOf("Technical") !== -1) policyArea.setAttribute("data-area", "technical");
                else if (areaName.indexOf("Ethical") !== -1) policyArea.setAttribute("data-area", "ethical");


                var areaHeader = document.createElement("div");
                areaHeader.className = "policy-area-header";
                areaHeader.addEventListener("click", function() { policyArea.classList.toggle("expanded"); });


                var areaTitle = document.createElement("span");
                areaTitle.className = "policy-area-title";
                areaTitle.textContent = areaName;
                areaHeader.appendChild(areaTitle);


                var areaMeta = document.createElement("div");
                areaMeta.className = "policy-area-meta";


                var sourceCount = document.createElement("span");
                sourceCount.className = "source-count";
                sourceCount.textContent = areaTotal + " entries";
                areaMeta.appendChild(sourceCount);


                var expandIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                expandIcon.setAttribute("class", "expand-icon");
                expandIcon.setAttribute("viewBox", "0 0 24 24");
                expandIcon.setAttribute("fill", "none");
                expandIcon.setAttribute("stroke", "currentColor");
                var expandPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                expandPath.setAttribute("stroke-linecap", "round");
                expandPath.setAttribute("stroke-linejoin", "round");
                expandPath.setAttribute("stroke-width", "2");
                expandPath.setAttribute("d", "M19 9l-7 7-7-7");
                expandIcon.appendChild(expandPath);
                areaMeta.appendChild(expandIcon);


                areaHeader.appendChild(areaMeta);
                policyArea.appendChild(areaHeader);


                var areaContent = document.createElement("div");
                areaContent.className = "policy-area-content";


                var legalSection = createSourceSection(filtered.legal_directives, "legal", "Legal Directives");
                if (legalSection) areaContent.appendChild(legalSection);


                var policySection = createSourceSection(filtered.policy_documents, "policy", "Policy Documents");
                if (policySection) areaContent.appendChild(policySection);
                                
                var statementSection = createSourceSection(filtered.public_statements, "statement", "Public Statements");
                if (statementSection) areaContent.appendChild(statementSection);


                policyArea.appendChild(areaContent);
                areasContainer.appendChild(policyArea);
            });


            var areaCount = areasContainer.children.length;
            document.getElementById("overview-subtitle").textContent = totalCount + " entries across " + areaCount + " policy areas";


            var content = document.getElementById("overview-content");
            content.innerHTML = "";
            
            if (areaCount === 0) {
                content.innerHTML = '<div class="no-data-message">No results match the current filters</div>';
                return;
            }


            // Add summary box
            if (summary) {
                var summaryBox = document.createElement("div");
                summaryBox.className = "country-summary-box";
                summaryBox.textContent = summary;
                content.appendChild(summaryBox);
            }


            // Add insights row with pie chart and bar chart (Option A: Side by Side Layout)
            var insightsRow = document.createElement("div");
            insightsRow.className = "country-insights-row";
            insightsRow.id = "insights-container";


            // Define policy areas with keys for hover coordination
            var policyAreasConfig = [
                { key: "ethical", name: "Ethical Guidelines & Restrictions", short: "Ethical\nGuidelines", color: "#4a9d5b" },
                { key: "adoption", name: "Adoption & Intent of Use", short: "Adoption &\nIntent", color: "#d64045" },
                { key: "acquisition", name: "Acquisition & Procurement", short: "Acquisition &\nProcurement", color: "#6b3074" },
                { key: "technical", name: "Technical Safety & Security Requirements", short: "Technical\nSafety", color: "#e07020" },
                { key: "laws", name: "LAWS Employment/Deployment", short: "LAWS\nDeployment", color: "#1a2744" },
                { key: "international", name: "Int'l Cooperation & Interoperability", short: "Int'l\nCooperation", color: "#0d7377" }
            ];


            // Build data object keyed by area key
            var chartData = {};
            policyAreasConfig.forEach(function(areaConfig) {
                var entries = data[areaConfig.name];
                if (entries) {
                    var areaLegal = filters.legal ? entries.legal_directives.length : 0;
                    var areaPolicy = filters.policy ? entries.policy_documents.length : 0;
                    var areaStatement = filters.statement ? entries.public_statements.length : 0;
                    chartData[areaConfig.key] = areaLegal + areaPolicy + areaStatement;
                } else {
                    chartData[areaConfig.key] = 0;
                }
            });


            // ===== PIE CHART SECTION =====
            var pieSection = document.createElement("div");
            pieSection.className = "chart-section";


            var pieTitle = document.createElement("div");
            pieTitle.className = "pie-chart-title";
            pieTitle.textContent = "Policy Distribution";
            pieSection.appendChild(pieTitle);


            var pieWrapper = document.createElement("div");
            pieWrapper.className = "pie-chart-wrapper";


            // Create SVG pie chart (Option A: Enlarged dimensions)
            var pieSvgWidth = 500;
            var pieSvgHeight = 380;
            var pieRadius = 100;
            var pieCenterX = pieSvgWidth / 2;
            var pieCenterY = pieSvgHeight / 2;


            var pieSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            pieSvg.setAttribute("class", "pie-chart-svg");
            pieSvg.setAttribute("width", pieSvgWidth);
            pieSvg.setAttribute("height", pieSvgHeight);
            pieSvg.setAttribute("viewBox", "0 0 " + pieSvgWidth + " " + pieSvgHeight);


            // Draw pie slices
            var pieStartAngle = -Math.PI / 2;
            var pieSliceData = [];


            policyAreasConfig.forEach(function(areaConfig) {
                var value = chartData[areaConfig.key];
                if (value === 0) return;


                var sliceAngle = (value / totalCount) * 2 * Math.PI;
                var endAngle = pieStartAngle + sliceAngle;


                var x1 = pieCenterX + pieRadius * Math.cos(pieStartAngle);
                var y1 = pieCenterY + pieRadius * Math.sin(pieStartAngle);
                var x2 = pieCenterX + pieRadius * Math.cos(endAngle);
                var y2 = pieCenterY + pieRadius * Math.sin(endAngle);


                var largeArc = sliceAngle > Math.PI ? 1 : 0;
                var pathD = "M " + pieCenterX + " " + pieCenterY + " L " + x1 + " " + y1 + " A " + pieRadius + " " + pieRadius + " 0 " + largeArc + " 1 " + x2 + " " + y2 + " Z";


                var slicePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                slicePath.setAttribute("d", pathD);
                slicePath.setAttribute("fill", areaConfig.color);
                slicePath.setAttribute("stroke", "white");
                slicePath.setAttribute("stroke-width", "2");
                slicePath.setAttribute("class", "pie-slice");
                slicePath.setAttribute("data-area", areaConfig.key);
                slicePath.setAttribute("data-area-name", areaConfig.name);
                pieSvg.appendChild(slicePath);


                // Store for labels
                var midAngle = pieStartAngle + sliceAngle / 2;
                pieSliceData.push({
                    key: areaConfig.key,
                    name: areaConfig.name,
                    short: areaConfig.short,
                    color: areaConfig.color,
                    midAngle: midAngle,
                    pct: Math.round((value / totalCount) * 100)
                });


                pieStartAngle = endAngle;
            });


            // Draw pie labels with leader lines
            var pieLabelRadius = pieRadius + 18;
            var pieTextOffset = 25;


            pieSliceData.forEach(function(slice) {
                var midAngle = slice.midAngle;
                var edgeX = pieCenterX + pieRadius * Math.cos(midAngle);
                var edgeY = pieCenterY + pieRadius * Math.sin(midAngle);
                var anchorX = pieCenterX + pieLabelRadius * Math.cos(midAngle);
                var anchorY = pieCenterY + pieLabelRadius * Math.sin(midAngle);
                var isRight = Math.cos(midAngle) >= 0;
                var lineEndX = isRight ? anchorX + pieTextOffset : anchorX - pieTextOffset;


                // Leader line
                var leaderLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
                leaderLine.setAttribute("points", edgeX + "," + edgeY + " " + anchorX + "," + anchorY + " " + lineEndX + "," + anchorY);
                leaderLine.setAttribute("fill", "none");
                leaderLine.setAttribute("stroke", "#999");
                leaderLine.setAttribute("stroke-width", "1");
                leaderLine.setAttribute("class", "pie-leader-line");
                leaderLine.setAttribute("data-area", slice.key);
                pieSvg.appendChild(leaderLine);


                // Dot at line end
                var leaderDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                leaderDot.setAttribute("cx", lineEndX);
                leaderDot.setAttribute("cy", anchorY);
                leaderDot.setAttribute("r", "3");
                leaderDot.setAttribute("fill", slice.color);
                leaderDot.setAttribute("class", "pie-leader-dot");
                leaderDot.setAttribute("data-area", slice.key);
                pieSvg.appendChild(leaderDot);


                // Label text
                var labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
                labelText.setAttribute("x", isRight ? lineEndX + 6 : lineEndX - 6);
                labelText.setAttribute("text-anchor", isRight ? "start" : "end");
                labelText.setAttribute("font-size", "12");
                labelText.setAttribute("font-family", "Plus Jakarta Sans, sans-serif");
                labelText.setAttribute("font-weight", "500");
                labelText.setAttribute("fill", "#333");
                labelText.setAttribute("class", "pie-label");
                labelText.setAttribute("data-area", slice.key);


                var lines = slice.short.split("\n");
                lines.forEach(function(txt, idx) {
                    var tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
                    tspan.setAttribute("x", isRight ? lineEndX + 6 : lineEndX - 6);
                    if (idx === 0) {
                        tspan.setAttribute("y", anchorY - 5);
                    } else {
                        tspan.setAttribute("dy", "14");
                    }
                    tspan.textContent = idx === lines.length - 1 ? txt + " (" + slice.pct + "%)" : txt;
                    labelText.appendChild(tspan);
                });


                pieSvg.appendChild(labelText);
            });


            pieWrapper.appendChild(pieSvg);
            pieSection.appendChild(pieWrapper);
            insightsRow.appendChild(pieSection);


            // ===== BAR CHART SECTION =====
            var barSection = document.createElement("div");
            barSection.className = "chart-section";


            var barTitle = document.createElement("div");
            barTitle.className = "bar-chart-title";
            barTitle.textContent = "Number of Policies by Area";
            barSection.appendChild(barTitle);


            var barWrapper = document.createElement("div");
            barWrapper.className = "bar-chart-wrapper";


            // Create SVG bar chart
            var barSvgWidth = 520;
            var barSvgHeight = 320;
            var barMargin = { top: 30, right: 25, bottom: 80, left: 55 };
            var barWidth = barSvgWidth - barMargin.left - barMargin.right;
            var barHeight = barSvgHeight - barMargin.top - barMargin.bottom;


            var barSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            barSvg.setAttribute("class", "bar-chart-svg");
            barSvg.setAttribute("width", barSvgWidth);
            barSvg.setAttribute("height", barSvgHeight);
            barSvg.setAttribute("viewBox", "0 0 " + barSvgWidth + " " + barSvgHeight);


            // Get max value for scale - round up to nearest even number
            var maxBarValue = Math.max.apply(null, Object.values(chartData).filter(function(v) { return v > 0; }));
            if (maxBarValue === 0 || maxBarValue === 1) maxBarValue = 2;
            // Round up to nearest even number
            maxBarValue = Math.ceil(maxBarValue / 2) * 2;
            var yScale = barHeight / maxBarValue;
            var singleBarWidth = barWidth / policyAreasConfig.length * 0.7;
            var barGap = barWidth / policyAreasConfig.length * 0.3;


            // Y-axis line
            var yAxisLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            yAxisLine.setAttribute("x1", barMargin.left);
            yAxisLine.setAttribute("y1", barMargin.top);
            yAxisLine.setAttribute("x2", barMargin.left);
            yAxisLine.setAttribute("y2", barMargin.top + barHeight);
            yAxisLine.setAttribute("stroke", "#ccc");
            yAxisLine.setAttribute("stroke-width", "1");
            barSvg.appendChild(yAxisLine);


            // X-axis line
            var xAxisLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            xAxisLine.setAttribute("x1", barMargin.left);
            xAxisLine.setAttribute("y1", barMargin.top + barHeight);
            xAxisLine.setAttribute("x2", barMargin.left + barWidth);
            xAxisLine.setAttribute("y2", barMargin.top + barHeight);
            xAxisLine.setAttribute("stroke", "#ccc");
            xAxisLine.setAttribute("stroke-width", "1");
            barSvg.appendChild(xAxisLine);


            // Y-axis title
            var yAxisTitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
            yAxisTitle.setAttribute("x", 15);
            yAxisTitle.setAttribute("y", barMargin.top + barHeight / 2);
            yAxisTitle.setAttribute("text-anchor", "middle");
            yAxisTitle.setAttribute("font-size", "11");
            yAxisTitle.setAttribute("fill", "#666");
            yAxisTitle.setAttribute("transform", "rotate(-90, 15, " + (barMargin.top + barHeight / 2) + ")");
            yAxisTitle.textContent = "Number of Policies";
            barSvg.appendChild(yAxisTitle);


            // Y-axis ticks and grid lines - every 2 numbers
            var tickStep = 2;
            var numTicks = maxBarValue / tickStep;
            for (var i = 0; i <= numTicks; i++) {
                var tickValue = i * tickStep;
                var yPos = barMargin.top + barHeight - (tickValue * yScale);


                // Grid line
                var gridLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
                gridLine.setAttribute("x1", barMargin.left);
                gridLine.setAttribute("y1", yPos);
                gridLine.setAttribute("x2", barMargin.left + barWidth);
                gridLine.setAttribute("y2", yPos);
                gridLine.setAttribute("stroke", "#eee");
                gridLine.setAttribute("stroke-width", "1");
                barSvg.appendChild(gridLine);


                // Tick label
                var tickLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                tickLabel.setAttribute("x", barMargin.left - 8);
                tickLabel.setAttribute("y", yPos + 4);
                tickLabel.setAttribute("text-anchor", "end");
                tickLabel.setAttribute("font-size", "10");
                tickLabel.setAttribute("fill", "#666");
                tickLabel.textContent = tickValue;
                barSvg.appendChild(tickLabel);
            }


            // Draw bars
            policyAreasConfig.forEach(function(areaConfig, idx) {
                var value = chartData[areaConfig.key];
                var rectHeight = value * yScale;
                var xPos = barMargin.left + idx * (singleBarWidth + barGap) + barGap / 2;
                var yPos = barMargin.top + barHeight - rectHeight;


                // Bar rectangle
                var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                rect.setAttribute("x", xPos);
                rect.setAttribute("y", yPos);
                rect.setAttribute("width", singleBarWidth);
                rect.setAttribute("height", rectHeight);
                rect.setAttribute("fill", areaConfig.color);
                rect.setAttribute("rx", "3");
                rect.setAttribute("class", "bar-rect");
                rect.setAttribute("data-area", areaConfig.key);
                rect.setAttribute("data-area-name", areaConfig.name);
                barSvg.appendChild(rect);


                // Value label above bar (or at baseline for zero)
                var valueLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                valueLabel.setAttribute("x", xPos + singleBarWidth / 2);
                valueLabel.setAttribute("y", value > 0 ? yPos - 8 : barMargin.top + barHeight - 8);
                valueLabel.setAttribute("text-anchor", "middle");
                valueLabel.setAttribute("font-size", "11");
                valueLabel.setAttribute("font-weight", "600");
                valueLabel.setAttribute("fill", value > 0 ? "#333" : "#999");
                valueLabel.setAttribute("class", "bar-value");
                valueLabel.setAttribute("data-area", areaConfig.key);
                valueLabel.textContent = value;
                barSvg.appendChild(valueLabel);


                // X-axis label (rotated)
                var shortLabel = areaConfig.short.replace("\n", " ");
                var xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                xLabel.setAttribute("x", xPos + singleBarWidth / 2);
                xLabel.setAttribute("y", barMargin.top + barHeight + 12);
                xLabel.setAttribute("text-anchor", "start");
                xLabel.setAttribute("font-size", "10");
                xLabel.setAttribute("fill", "#666");
                xLabel.setAttribute("transform", "rotate(35, " + (xPos + singleBarWidth / 2) + ", " + (barMargin.top + barHeight + 12) + ")");
                xLabel.setAttribute("class", "bar-label");
                xLabel.setAttribute("data-area", areaConfig.key);
                xLabel.textContent = shortLabel;
                barSvg.appendChild(xLabel);
            });


            barWrapper.appendChild(barSvg);
            barSection.appendChild(barWrapper);
            insightsRow.appendChild(barSection);


            // ===== INTERACTION HINT =====
            var hintDiv = document.createElement("div");
            hintDiv.className = "insights-hint";
            hintDiv.innerHTML = "<strong>Tip:</strong> Hover to highlight + Click to expand policies below";
            insightsRow.appendChild(hintDiv);


            // ===== ADD TO DOM =====
            content.appendChild(insightsRow);


            // ===== SETUP HOVER AND CLICK INTERACTIONS =====
            setTimeout(function() {
                var container = document.getElementById("insights-container");
                if (!container) return;


                // Map from key to full policy area name
                var keyToNameMap = {};
                policyAreasConfig.forEach(function(cfg) {
                    keyToNameMap[cfg.key] = cfg.name;
                });


                var clickableElements = container.querySelectorAll(".pie-slice, .bar-rect");
                var allDataElements = container.querySelectorAll("[data-area]");


                // Hover interactions
                allDataElements.forEach(function(el) {
                    el.addEventListener("mouseenter", function() {
                        var area = this.getAttribute("data-area");
                        container.classList.add("has-hover");


                        allDataElements.forEach(function(other) {
                            if (other.getAttribute("data-area") === area) {
                                other.classList.add("highlighted");
                            }
                        });
                    });


                    el.addEventListener("mouseleave", function() {
                        container.classList.remove("has-hover");
                        allDataElements.forEach(function(other) {
                            other.classList.remove("highlighted");
                        });
                    });
                });


                // Click interactions - expand corresponding policy area
                clickableElements.forEach(function(el) {
                    el.addEventListener("click", function() {
                        var areaKey = this.getAttribute("data-area");
                        var areaName = keyToNameMap[areaKey];
                        
                        if (!areaName) return;


                        // Find the policy area section with matching name
                        var policyAreas = document.querySelectorAll(".policy-area");
                        policyAreas.forEach(function(policyArea) {
                            var titleEl = policyArea.querySelector(".policy-area-title");
                            if (titleEl && titleEl.textContent === areaName) {
                                // Expand this policy area
                                policyArea.classList.add("expanded");
                                
                                // Scroll to it smoothly
                                setTimeout(function() {
                                    policyArea.scrollIntoView({ behavior: "smooth", block: "start" });
                                }, 100);
                            }
                        });
                    });
                });
            }, 0);


            // Add policy areas
            content.appendChild(areasContainer);
        }


        document.querySelectorAll(".filter-checkbox input").forEach(function(cb) {
            cb.addEventListener("change", renderOverview);
        });


        // ===== COMPARE FUNCTIONS =====
        function toggleCompareCountry(country) {
            if (selectedCountries.has(country)) {
                selectedCountries.delete(country);
            } else if (selectedCountries.size < MAX_COMPARE) {
                selectedCountries.add(country);
            }
            updateCompareChipsState();
            updateMapHighlights();
            renderComparison();
        }


        function buildPolicyAreaDropdown() {
            var dropdown = document.getElementById("policy-area-dropdown");
            if (!dropdown) return; // Element removed in redesign
            
            var allAreas = new Set();


            Object.values(policyData).forEach(function(country) {
                Object.keys(country).forEach(function(area) { allAreas.add(area); });
            });


            Array.from(allAreas).sort().forEach(function(area) {
                var option = document.createElement("option");
                option.value = area;
                option.textContent = area;
                dropdown.appendChild(option);
            });


            dropdown.addEventListener("change", function() {
                selectedPolicyArea = this.value;
                renderComparison();
            });
        }


        // Render pairwise convergence chart for country comparison
        function renderPairwiseConvergenceChart(country1, country2) {
            var container = document.getElementById("pairwise-convergence-chart");
            if (!container) return;
            
            var years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
            var dims = ['LAWS', 'Adoption', 'Procurement', 'Safety', 'Ethics', 'Interoperability'];
            
            // Get yearly scores from pre-calculated data
            var yearlyScores = rawData.yearlyScores || {};
            var scores1 = yearlyScores[country1];
            var scores2 = yearlyScores[country2];
            
            if (!scores1 || !scores2) {
                container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px;">Yearly score data not available for this pair</div>';
                return;
            }
            
            // Calculate blended similarity for each year using pre-calculated yearly scores
            function calcYearlySimilarity(year) {
                var yearStr = year.toString();
                var s1 = scores1[yearStr];
                var s2 = scores2[yearStr];
                
                if (!s1 || !s2) return null;
                
                // Count how many areas each country has data for
                var country1Areas = 0;
                var country2Areas = 0;
                
                dims.forEach(function(dim) {
                    if (s1[dim] !== null && s1[dim] !== undefined) country1Areas++;
                    if (s2[dim] !== null && s2[dim] !== undefined) country2Areas++;
                });
                
                // If either country has NO policy data for this year, return null
                if (country1Areas === 0 || country2Areas === 0) {
                    return null;
                }
                
                var presenceScore = 0;
                var substanceScore = 0;
                var activeAreas = 0;
                
                dims.forEach(function(dim) {
                    var v1 = s1[dim];
                    var v2 = s2[dim];
                    
                    var has1 = v1 !== null && v1 !== undefined;
                    var has2 = v2 !== null && v2 !== undefined;
                    
                    // Presence similarity: only count areas where at least one country has data
                    if (has1 || has2) {
                        if (has1 === has2) {
                            presenceScore += 1;
                        }
                    }
                    
                    // Substance similarity: only for areas where both countries have data
                    if (has1 && has2) {
                        var dimSim = 1 - Math.abs(v1 - v2) / 4;
                        substanceScore += dimSim;
                        activeAreas++;
                    }
                });
                
                // Normalize presence score by areas where at least one has data
                var relevantAreas = 0;
                dims.forEach(function(dim) {
                    if ((s1[dim] !== null && s1[dim] !== undefined) || 
                        (s2[dim] !== null && s2[dim] !== undefined)) {
                        relevantAreas++;
                    }
                });
                
                presenceScore = relevantAreas > 0 ? presenceScore / relevantAreas : 0;
                substanceScore = activeAreas > 0 ? substanceScore / activeAreas : 0;
                
                // Calculate base similarity
                var baseSimilarity;
                if (activeAreas === 0) {
                    baseSimilarity = presenceScore * 0.3; // Lower weight when no substance overlap
                } else {
                    baseSimilarity = 0.2 * presenceScore + 0.8 * substanceScore;
                }
                
                // Apply voting divergence penalty
                var votingPenalty = calcVotingDivergencePenalty(country1, country2, year);
                return Math.min(1, Math.max(0, baseSimilarity - votingPenalty));
            }
            
            var dataPoints = [];
            years.forEach(function(year) {
                var sim = calcYearlySimilarity(year);
                dataPoints.push({ year: year, similarity: sim });
            });
            
            // Render SVG
            var width = container.offsetWidth || 500;
            var height = 200;
            var margin = { top: 20, right: 20, bottom: 35, left: 50 };
            var plotWidth = width - margin.left - margin.right;
            var plotHeight = height - margin.top - margin.bottom;
            
            var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", width);
            svg.setAttribute("height", height);
            svg.setAttribute("viewBox", "0 0 " + width + " " + height);
            
            // Y-axis gridlines and labels
            [0, 25, 50, 75, 100].forEach(function(val) {
                var y = margin.top + plotHeight - (val / 100) * plotHeight;
                
                // Grid line
                var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", margin.left);
                line.setAttribute("y1", y);
                line.setAttribute("x2", width - margin.right);
                line.setAttribute("y2", y);
                line.setAttribute("stroke", val === 50 ? "#bbb" : "#e8ebef");
                line.setAttribute("stroke-width", val === 50 ? "1.5" : "1");
                if (val === 50) line.setAttribute("stroke-dasharray", "4,4");
                svg.appendChild(line);
                
                // Label
                var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                label.setAttribute("x", margin.left - 8);
                label.setAttribute("y", y + 4);
                label.setAttribute("text-anchor", "end");
                label.setAttribute("font-size", "10");
                label.setAttribute("fill", "#7a8a9a");
                label.textContent = val + "%";
                svg.appendChild(label);
            });
            
            // X-axis labels
            years.forEach(function(year, idx) {
                var x = margin.left + (idx / (years.length - 1)) * plotWidth;
                var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                label.setAttribute("x", x);
                label.setAttribute("y", height - 10);
                label.setAttribute("text-anchor", "middle");
                label.setAttribute("font-size", "10");
                label.setAttribute("fill", "#7a8a9a");
                label.textContent = year;
                svg.appendChild(label);
            });
            
            // Build path for similarity line
            var pathD = "";
            var validPoints = [];
            dataPoints.forEach(function(pt, idx) {
                if (pt.similarity !== null) {
                    var x = margin.left + (idx / (years.length - 1)) * plotWidth;
                    var y = margin.top + plotHeight - (pt.similarity * plotHeight);
                    validPoints.push({ x: x, y: y, year: pt.year, sim: pt.similarity });
                }
            });
            
            if (validPoints.length > 0) {
                // Area fill
                var areaPath = "M" + validPoints[0].x + "," + (margin.top + plotHeight);
                validPoints.forEach(function(pt) {
                    areaPath += " L" + pt.x + "," + pt.y;
                });
                areaPath += " L" + validPoints[validPoints.length - 1].x + "," + (margin.top + plotHeight) + " Z";
                
                var area = document.createElementNS("http://www.w3.org/2000/svg", "path");
                area.setAttribute("d", areaPath);
                area.setAttribute("fill", "rgba(13, 115, 119, 0.15)");
                svg.appendChild(area);
                
                // Line
                pathD = "M" + validPoints[0].x + "," + validPoints[0].y;
                for (var i = 1; i < validPoints.length; i++) {
                    pathD += " L" + validPoints[i].x + "," + validPoints[i].y;
                }
                
                var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", pathD);
                path.setAttribute("stroke", "#0d7377");
                path.setAttribute("stroke-width", "2.5");
                path.setAttribute("fill", "none");
                path.setAttribute("stroke-linejoin", "round");
                svg.appendChild(path);
                
                // Data points
                validPoints.forEach(function(pt) {
                    var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    circle.setAttribute("cx", pt.x);
                    circle.setAttribute("cy", pt.y);
                    circle.setAttribute("r", "4");
                    circle.setAttribute("fill", "#0d7377");
                    circle.setAttribute("stroke", "#fff");
                    circle.setAttribute("stroke-width", "2");
                    svg.appendChild(circle);
                    
                    // Tooltip on hover
                    circle.style.cursor = "pointer";
                    circle.addEventListener("mouseenter", function(e) {
                        var tooltip = document.getElementById("convergence-pair-tooltip");
                        if (!tooltip) {
                            tooltip = document.createElement("div");
                            tooltip.id = "convergence-pair-tooltip";
                            tooltip.style.cssText = "position:fixed;background:#1a2744;color:#fff;padding:8px 12px;border-radius:6px;font-size:12px;pointer-events:none;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);";
                            document.body.appendChild(tooltip);
                        }
                        tooltip.innerHTML = "<strong>" + pt.year + "</strong><br>Similarity: " + Math.round(pt.sim * 100) + "%";
                        tooltip.style.left = (e.clientX + 10) + "px";
                        tooltip.style.top = (e.clientY - 40) + "px";
                        tooltip.style.display = "block";
                    });
                    circle.addEventListener("mouseleave", function() {
                        var tooltip = document.getElementById("convergence-pair-tooltip");
                        if (tooltip) tooltip.style.display = "none";
                    });
                });
            } else {
                // No data message
                var noData = document.createElementNS("http://www.w3.org/2000/svg", "text");
                noData.setAttribute("x", width / 2);
                noData.setAttribute("y", height / 2);
                noData.setAttribute("text-anchor", "middle");
                noData.setAttribute("font-size", "12");
                noData.setAttribute("fill", "#7a8a9a");
                noData.textContent = "No overlapping policy data available";
                svg.appendChild(noData);
            }
            
            container.innerHTML = "";
            container.appendChild(svg);
        }


        function renderComparison() {
            var content = document.getElementById("compare-content");


            if (selectedCountries.size === 0) {
                content.innerHTML = '<div class="placeholder"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg><p>Select 2 countries to compare their<br>defense AI policy frameworks</p></div>';
                return;
            }


            if (selectedCountries.size === 1) {
                content.innerHTML = '<div class="placeholder"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" /></svg><p>Select one more country to<br>compare policy frameworks</p></div>';
                return;
            }


            // Get the two countries
            var countries = Array.from(selectedCountries);
            var country1 = countries[0];
            var country2 = countries[1];
            var name1 = displayNames[country1] || country1;
            var name2 = displayNames[country2] || country2;
            var data1 = policyData[country1];
            var data2 = policyData[country2];


            // ISO Alpha-3 country codes
            var isoAlpha3 = {
                "Algeria": "DZA",
                "Armenia": "ARM",
                "Australia": "AUS",
                "Azerbaijan": "AZE",
                "Belgium": "BEL",
                "Brazil": "BRA",
                "Bulgaria": "BGR",
                "Canada": "CAN",
                "China": "CHN",
                "Colombia": "COL",
                "Croatia": "HRV",
                "Czechia": "CZE",
                "Denmark": "DNK",
                "Egypt": "EGY",
                "Estonia": "EST",
                "Finland": "FIN",
                "France": "FRA",
                "Germany": "DEU",
                "Greece": "GRC",
                "Hungary": "HUN",
                "India": "IND",
                "Iran": "IRN",
                "Iraq": "IRQ",
                "Israel": "ISR",
                "Italy": "ITA",
                "Japan": "JPN",
                "Latvia": "LVA",
                "Lithuania": "LTU",
                "Morocco": "MAR",
                "Netherlands": "NLD",
                "North Korea": "PRK",
                "Norway": "NOR",
                "Pakistan": "PAK",
                "Poland": "POL",
                "Russia": "RUS",
                "Singapore": "SGP",
                "South Africa": "ZAF",
                "South Korea": "KOR",
                "Spain": "ESP",
                "Sweden": "SWE",
                "Turkey": "TUR",
                "UAE": "ARE",
                "UK": "GBR",
                "USA": "USA",
                "Ukraine": "UKR"
            };
            
            function getAlpha3(countryName) {
                return isoAlpha3[countryName] || countryName.substring(0, 3).toUpperCase();
            }


            // Calculate totals and area counts
            var policyAreas = [
                "LAWS Employment/Deployment",
                "Adoption & Intent of Use",
                "Acquisition & Procurement",
                "Ethical Guidelines & Restrictions",
                "Int'l Cooperation & Interoperability",
                "Technical Safety & Security Requirements",
                "Training & Human-AI Interaction"
            ];


            function countEntries(countryData, areaName) {
                var area = countryData[areaName];
                if (!area) return 0;
                return (area.legal_directives || []).length + 
                       (area.policy_documents || []).length + 
                       (area.public_statements || []).length;
            }


            function getTotalEntries(countryData) {
                var total = 0;
                Object.keys(countryData).forEach(function(area) {
                    total += countEntries(countryData, area);
                });
                return total;
            }


            function getTimelineEntries(countryData) {
                var entries = [];
                var seen = {}; // Track unique year+title combinations
                Object.keys(countryData).forEach(function(areaName) {
                    var area = countryData[areaName];
                    if (!area) return;
                    var allSources = (area.legal_directives || [])
                        .concat(area.policy_documents || [])
                        .concat(area.public_statements || []);
                    allSources.forEach(function(entry) {
                        var text = entry.text || entry;
                        // Match (Mon YYYY) or (Month YYYY) or (YYYY)
                        var dateMatch = text.match(/\(([A-Za-z]+)?\s*(\d{4})\)/);
                        if (dateMatch) {
                            var monthStr = dateMatch[1] || '';
                            var year = parseInt(dateMatch[2]);
                            
                            // Format date string as "Mon YYYY" or just "YYYY" if no month
                            var dateDisplay = '';
                            if (monthStr) {
                                // Abbreviate month to 3 letters
                                var monthAbbr = monthStr.substring(0, 3);
                                dateDisplay = monthAbbr + ' ' + year;
                            } else {
                                dateDisplay = 'Q4 ' + year; // Default to Q4 if no month
                            }
                            
                            // Get title without any trailing date patterns
                            var titleBase = text.split("\n")[0];
                            // Remove all trailing (Month YYYY) or (YYYY) patterns
                            while (/\s*\([A-Za-z]*\s*\d{4}\)\s*$/.test(titleBase)) {
                                titleBase = titleBase.replace(/\s*\([A-Za-z]*\s*\d{4}\)\s*$/, '');
                            }
                            titleBase = titleBase.trim();
                            
                            var title = titleBase + ' (' + dateDisplay + ')';
                            
                            var key = year + "|" + titleBase.toLowerCase();
                            if (!seen[key]) {
                                seen[key] = true;
                                entries.push({ year: year, title: title, area: areaName });
                            }
                        }
                    });
                });
                return entries;
            }


            var total1 = getTotalEntries(data1);
            var total2 = getTotalEntries(data2);
            var maxValue = Math.max(total1, total2);
            var timeline1 = getTimelineEntries(data1);
            var timeline2 = getTimelineEntries(data2);


            // Build HTML
            var html = '';


            // Header chips removed - country names now above bars


            // Bar Chart Section
            html += '<div class="compare-section-box">';
            html += '<div class="chart-header-row">';
            html += '<h3 class="compare-section-title">Policy Area Coverage</h3>';
            html += '<div class="country-names-row">';
            html += '<div class="country-name-label country-1"><span class="country-name-dot"></span>' + escapeHtml(name1) + '</div>';
            html += '<div class="country-name-spacer"></div>';
            html += '<div class="country-name-label country-2">' + escapeHtml(name2) + '<span class="country-name-dot"></span></div>';
            html += '</div>';
            html += '</div>';
            html += '<div class="diverging-chart">';


            // Total row
            var leftPct = maxValue > 0 ? (total1 / maxValue) * 100 : 0;
            var rightPct = maxValue > 0 ? (total2 / maxValue) * 100 : 0;
            html += '<div class="chart-row total-row">';
            html += '<div class="chart-value-left">' + total1 + '</div>';
            html += '<div class="chart-bar-left"><div class="chart-bar left" style="width:' + leftPct + '%"></div></div>';
            html += '<div class="chart-row-label total">TOTAL ENTRIES</div>';
            html += '<div class="chart-bar-right"><div class="chart-bar right" style="width:' + rightPct + '%"></div></div>';
            html += '<div class="chart-value-right">' + total2 + '</div>';
            html += '</div>';


            // Policy area rows
            policyAreas.forEach(function(areaName, idx) {
                var count1 = countEntries(data1, areaName);
                var count2 = countEntries(data2, areaName);
                if (count1 === 0 && count2 === 0) return;


                var leftW = maxValue > 0 ? (count1 / maxValue) * 100 : 0;
                var rightW = maxValue > 0 ? (count2 / maxValue) * 100 : 0;
                var shortLabel = areaName.replace("Lethal Autonomous Weapons Systems (LAWS) ", "LAWS ").replace(" & Restrictions", "").replace(" & Interoperability", "").replace(" & Security Requirements", "").replace(" & Human-AI Interaction", "");


                html += '<div class="chart-row clickable" data-area="' + escapeHtml(areaName) + '" data-section-id="detail-section-' + idx + '">';
                html += '<div class="chart-value-left">' + count1 + '</div>';
                html += '<div class="chart-bar-left"><div class="chart-bar left" style="width:' + leftW + '%"></div></div>';
                html += '<div class="chart-row-label">' + escapeHtml(shortLabel) + '</div>';
                html += '<div class="chart-bar-right"><div class="chart-bar right" style="width:' + rightW + '%"></div></div>';
                html += '<div class="chart-value-right">' + count2 + '</div>';
                html += '</div>';
            });


            html += '</div></div>';


            // Timeline Section
            var allYears = timeline1.concat(timeline2).map(function(e) { return e.year; });
            if (allYears.length > 0) {
                var minYear = Math.min.apply(null, allYears) - 1; // One year before earliest
                var maxYear = Math.max(2025, Math.max.apply(null, allYears)); // At least 2025, or max from data


                // Group entries by year for each country
                function groupByYear(entries) {
                    var grouped = {};
                    entries.forEach(function(entry) {
                        if (!grouped[entry.year]) grouped[entry.year] = [];
                        grouped[entry.year].push(entry);
                    });
                    return grouped;
                }


                var grouped1 = groupByYear(timeline1);
                var grouped2 = groupByYear(timeline2);


                html += '<div class="compare-section-box">';
                html += '<h3 class="compare-section-title">Policy Development Timeline</h3>';
                html += '<div class="compare-timeline-container">';


                // Country 1 row
                html += '<div class="timeline-row">';
                html += '<div class="timeline-row-label country-1">' + escapeHtml(getAlpha3(country1)) + '</div>';
                
                Object.keys(grouped1).forEach(function(year) {
                    var entries = grouped1[year];
                    var pos = ((year - minYear) / (maxYear - minYear)) * 100;
                    var numCols = Math.ceil(entries.length / 5);
                    
                    entries.forEach(function(entry, idx) {
                        var colIdx = Math.floor(idx / 5);
                        var rowIdx = idx % 5;
                        var offsetX = (colIdx - (numCols - 1) / 2) * 14; // 14px spacing between columns
                        // Country 1: emanate upward from bottom (near axis)
                        var offsetY = -rowIdx * 13; // Stack upward from bottom
                        
                        html += '<div class="timeline-dot country-1" style="left:calc(' + pos + '% + ' + offsetX + 'px); bottom:' + (5 + rowIdx * 13) + 'px;" data-title="' + escapeHtml(entry.title) + '" data-year="' + year + '" data-country="' + escapeHtml(name1) + '"></div>';
                    });
                });
                html += '</div>';


                // Axis
                html += '<div class="timeline-axis"></div>';


                // Country 2 row
                html += '<div class="timeline-row">';
                html += '<div class="timeline-row-label country-2">' + escapeHtml(getAlpha3(country2)) + '</div>';
                
                Object.keys(grouped2).forEach(function(year) {
                    var entries = grouped2[year];
                    var pos = ((year - minYear) / (maxYear - minYear)) * 100;
                    var numCols = Math.ceil(entries.length / 5);
                    
                    entries.forEach(function(entry, idx) {
                        var colIdx = Math.floor(idx / 5);
                        var rowIdx = idx % 5;
                        var offsetX = (colIdx - (numCols - 1) / 2) * 14;
                        // Country 2: emanate downward from top (near axis)
                        
                        html += '<div class="timeline-dot country-2" style="left:calc(' + pos + '% + ' + offsetX + 'px); top:' + (5 + rowIdx * 13) + 'px;" data-title="' + escapeHtml(entry.title) + '" data-year="' + year + '" data-country="' + escapeHtml(name2) + '"></div>';
                    });
                });
                html += '</div>';


                // Year labels
                html += '<div class="timeline-year-labels">';
                for (var y = minYear; y <= maxYear; y++) {
                    html += '<div class="timeline-year-label">' + y + '</div>';
                }
                html += '</div>';


                // Legend
                html += '<div class="timeline-legend">';
                html += '<div class="timeline-legend-item"><div class="timeline-legend-dot country-1"></div><span>' + escapeHtml(getAlpha3(country1)) + '</span></div>';
                html += '<div class="timeline-legend-item"><div class="timeline-legend-dot country-2"></div><span>' + escapeHtml(getAlpha3(country2)) + '</span></div>';
                html += '</div>';


                html += '</div></div>';
            }


            // Convergence/Divergence Timeline Section
            html += '<div class="compare-section-box convergence-similarity-section">';
            
            // Calculate current similarity using the same data source as the chart (yearlyScores for 2025)
            var currentSim = 0;
            var dims = ['LAWS', 'Adoption', 'Procurement', 'Safety', 'Ethics', 'Interoperability'];
            
            var yearlyScores = rawData.yearlyScores || {};
            var scores1 = yearlyScores[country1] ? yearlyScores[country1]['2025'] : null;
            var scores2 = yearlyScores[country2] ? yearlyScores[country2]['2025'] : null;
            
            if (scores1 && scores2) {
                // Count how many areas each country has data for
                var country1Areas = 0;
                var country2Areas = 0;
                
                dims.forEach(function(dim) {
                    if (scores1[dim] !== null && scores1[dim] !== undefined) country1Areas++;
                    if (scores2[dim] !== null && scores2[dim] !== undefined) country2Areas++;
                });
                
                // Only calculate if both have data
                if (country1Areas > 0 && country2Areas > 0) {
                    var presenceScore = 0;
                    var substanceScore = 0;
                    var activeAreas = 0;
                    var relevantAreas = 0;
                    
                    dims.forEach(function(dim) {
                        var v1 = scores1[dim];
                        var v2 = scores2[dim];
                        
                        var has1 = v1 !== null && v1 !== undefined;
                        var has2 = v2 !== null && v2 !== undefined;
                        
                        // Only count areas where at least one country has data
                        if (has1 || has2) {
                            relevantAreas++;
                            if (has1 === has2) presenceScore += 1;
                        }
                        
                        // Substance similarity for areas where both have data
                        if (has1 && has2) {
                            var dimSim = 1 - Math.abs(v1 - v2) / 4;
                            substanceScore += dimSim;
                            activeAreas++;
                        }
                    });
                    
                    presenceScore = relevantAreas > 0 ? presenceScore / relevantAreas : 0;
                    substanceScore = activeAreas > 0 ? substanceScore / activeAreas : 0;
                    
                    // Blend: 20% presence + 80% substance
                    var baseSim = activeAreas > 0 ? (0.2 * presenceScore + 0.8 * substanceScore) : presenceScore * 0.3;
                    
                    // Apply voting divergence penalty (current year = 2025)
                    var votingPenalty = calcVotingDivergencePenalty(country1, country2, 2025);
                    currentSim = Math.min(1, Math.max(0, baseSim - votingPenalty));
                }
            }
            
            // Header with percentage
            html += '<h3 class="compare-section-title" style="display: flex; justify-content: space-between; align-items: center;">';
            html += '<span>Policy Convergence Timeline</span>';
            html += '<span style="font-size: 1.1rem; color: var(--teal); font-weight: 700;">' + Math.round(currentSim * 100) + '% Current Similarity</span>';
            html += '</h3>';
            
            // Interpret similarity
            var interpretation = "";
            if (currentSim >= 0.8) interpretation = "Highly Aligned";
            else if (currentSim >= 0.6) interpretation = "Moderately Aligned";
            else if (currentSim >= 0.4) interpretation = "Partially Aligned";
            else if (currentSim >= 0.2) interpretation = "Divergent";
            else interpretation = "Highly Divergent";
            
            html += '<div class="convergence-current-similarity" style="text-align: center; padding: 8px 0 16px;">';
            html += '<div class="similarity-interpretation" style="font-size: 0.85rem; color: #666;">' + interpretation + '</div>';
            html += '</div>';
            
            html += '<div class="convergence-similarity-chart" id="pairwise-convergence-chart" data-country1="' + escapeHtml(country1) + '" data-country2="' + escapeHtml(country2) + '"></div>';
            
            html += '<div class="convergence-chart-legend">';
            html += '<div class="convergence-chart-legend-item"><div class="convergence-legend-line similarity"></div><span>Policy Similarity</span></div>';
            html += '<div class="convergence-chart-legend-item"><div class="convergence-legend-line threshold"></div><span>50% Threshold</span></div>';
            html += '</div>';
            
            html += '</div>';


            // Detail List Section (Collapsible)
            html += '<div class="compare-section-box" style="padding:0;">';
            html += '<button class="detail-toggle-btn" id="compare-detail-toggle">';
            html += '<span>View Detailed Entry List</span>';
            html += '<span class="detail-toggle-icon">▼</span>';
            html += '</button>';
            html += '<div class="detail-content-wrapper" id="compare-detail-content" style="padding: 24px 30px; background: #fafbfc;">';


            policyAreas.forEach(function(areaName, idx) {
                var count1 = countEntries(data1, areaName);
                var count2 = countEntries(data2, areaName);
                if (count1 === 0 && count2 === 0) return;


                var area1 = data1[areaName] || {};
                var area2 = data2[areaName] || {};


                // Determine data-area for color coding
                var dataArea = "";
                if (areaName.indexOf("LAWS") !== -1) dataArea = "laws";
                else if (areaName.indexOf("Adoption") !== -1) dataArea = "adoption";
                else if (areaName.indexOf("Acquisition") !== -1) dataArea = "acquisition";
                else if (areaName.indexOf("International") !== -1) dataArea = "international";
                else if (areaName.indexOf("Technical") !== -1) dataArea = "technical";
                else if (areaName.indexOf("Ethical") !== -1) dataArea = "ethical";


                html += '<div class="detail-policy-section" id="detail-section-' + idx + '" data-area="' + dataArea + '">';
                html += '<div class="detail-policy-header">';
                html += '<span>' + escapeHtml(areaName) + '<span class="toggle-icon">▼</span></span>';
                html += '<div class="detail-policy-counts">';
                html += '<span class="count-1">' + escapeHtml(getAlpha3(country1)) + ': ' + count1 + '</span>';
                html += '<span class="count-2">' + escapeHtml(getAlpha3(country2)) + ': ' + count2 + '</span>';
                html += '</div></div>';


                html += '<div class="detail-policy-content">';
                html += '<div class="detail-entries-grid">';


                // Country 1 entries
                html += '<div class="detail-country-entries country-1">';
                html += '<h4>' + escapeHtml(getAlpha3(country1)) + '</h4>';
                var entries1 = (area1.legal_directives || []).concat(area1.policy_documents || []).concat(area1.public_statements || []);
                if (entries1.length === 0) {
                    html += '<div style="color: var(--text-muted); font-size: 0.85rem;">No entries</div>';
                } else {
                    entries1.forEach(function(entry) {
                        var text = entry.text || entry;
                        var url = entry.url || null;
                        var titleWithDate = text.split("\n")[0];
                        var title = parseTitleWithoutDate(text);
                        var date = extractDate(text);
                        var details = parseDetails(text);
                        
                        html += '<div class="detail-entry-item">';
                        html += '<div class="detail-entry-header">';
                        html += '<div class="detail-entry-info">';
                        if (url) {
                            html += '<div class="detail-entry-title"><a href="' + escapeHtml(url) + '" target="_blank">' + escapeHtml(title) + '</a></div>';
                        } else {
                            html += '<div class="detail-entry-title">' + escapeHtml(title) + '</div>';
                        }
                        if (date) html += '<div class="detail-entry-date">' + escapeHtml(date) + '</div>';
                        html += '</div>';
                        if (details) {
                            html += '<svg class="detail-entry-expand" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>';
                        }
                        html += '</div>';
                        if (details) {
                            html += '<div class="detail-entry-description">' + details + '</div>';
                        }
                        html += '</div>';
                    });
                }
                html += '</div>';


                // Country 2 entries
                html += '<div class="detail-country-entries country-2">';
                html += '<h4>' + escapeHtml(getAlpha3(country2)) + '</h4>';
                var entries2 = (area2.legal_directives || []).concat(area2.policy_documents || []).concat(area2.public_statements || []);
                if (entries2.length === 0) {
                    html += '<div style="color: var(--text-muted); font-size: 0.85rem;">No entries</div>';
                } else {
                    entries2.forEach(function(entry) {
                        var text = entry.text || entry;
                        var url = entry.url || null;
                        var titleWithDate = text.split("\n")[0];
                        var title = parseTitleWithoutDate(text);
                        var date = extractDate(text);
                        var details = parseDetails(text);
                        
                        html += '<div class="detail-entry-item">';
                        html += '<div class="detail-entry-header">';
                        html += '<div class="detail-entry-info">';
                        if (url) {
                            html += '<div class="detail-entry-title"><a href="' + escapeHtml(url) + '" target="_blank">' + escapeHtml(title) + '</a></div>';
                        } else {
                            html += '<div class="detail-entry-title">' + escapeHtml(title) + '</div>';
                        }
                        if (date) html += '<div class="detail-entry-date">' + escapeHtml(date) + '</div>';
                        html += '</div>';
                        if (details) {
                            html += '<svg class="detail-entry-expand" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>';
                        }
                        html += '</div>';
                        if (details) {
                            html += '<div class="detail-entry-description">' + details + '</div>';
                        }
                        html += '</div>';
                    });
                }
                html += '</div>';


                html += '</div></div></div>';
            });


            html += '</div></div>';


            content.innerHTML = html;


            // Render pairwise convergence chart
            renderPairwiseConvergenceChart(country1, country2);


            // Add event listeners
            // Toggle detail list
            var toggleBtn = document.getElementById("compare-detail-toggle");
            var detailContent = document.getElementById("compare-detail-content");
            if (toggleBtn && detailContent) {
                toggleBtn.addEventListener("click", function() {
                    toggleBtn.classList.toggle("open");
                    detailContent.classList.toggle("open");
                });
            }


            // Policy section header clicks (collapse/expand)
            content.querySelectorAll(".detail-policy-header").forEach(function(header) {
                header.addEventListener("click", function() {
                    header.parentElement.classList.toggle("expanded");
                });
            });


            // Detail entry item clicks (expand/collapse description)
            content.querySelectorAll(".detail-entry-header").forEach(function(header) {
                header.addEventListener("click", function(e) {
                    if (e.target.closest("a")) return; // Don't toggle if clicking link
                    header.parentElement.classList.toggle("expanded");
                });
            });


            // Chart row clicks
            content.querySelectorAll(".chart-row.clickable").forEach(function(row) {
                row.addEventListener("click", function() {
                    var sectionId = row.dataset.sectionId;
                    if (sectionId) {
                        // Open detail list if not open
                        if (!detailContent.classList.contains("open")) {
                            toggleBtn.click();
                        }
                        // Scroll to section and expand it
                        setTimeout(function() {
                            var section = document.getElementById(sectionId);
                            if (section) {
                                if (!section.classList.contains("expanded")) {
                                    section.classList.add("expanded");
                                }
                                section.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                        }, 100);
                    }
                });
            });


            // Timeline tooltip
            var tooltip = document.getElementById("compare-timeline-tooltip");
            if (!tooltip) {
                tooltip = document.createElement("div");
                tooltip.id = "compare-timeline-tooltip";
                tooltip.className = "compare-tooltip";
                document.body.appendChild(tooltip);
            }


            content.querySelectorAll(".timeline-dot").forEach(function(dot) {
                dot.addEventListener("mouseenter", function() {
                    tooltip.innerHTML = '<strong>' + dot.dataset.country + '</strong><br>' + dot.dataset.title;
                    tooltip.classList.add("visible");
                });
                dot.addEventListener("mousemove", function(e) {
                    tooltip.style.left = (e.clientX + 12) + "px";
                    tooltip.style.top = (e.clientY - 50) + "px";
                });
                dot.addEventListener("mouseleave", function() {
                    tooltip.classList.remove("visible");
                });
            });
        }


        // ===== MAP =====
        function updateMapHighlights() {
            var paths = document.querySelectorAll(".country-path");
            
            paths.forEach(function(path) {
                var country = path.getAttribute("data-country");
                var mapName = path.getAttribute("data-map-name");
                var isSelected = false;
                var isDisabled = false;
                var isAllianceMember = false;


                if (currentView === "overview") {
                    isSelected = country === selectedCountry;
                } else if (currentView === "alliance" && selectedAlliance) {
                    // Check if this country is a member of the selected alliance
                    var members = allianceMembers[selectedAlliance];
                    if (members && mapName) {
                        var memberName = allianceMemberMap[mapName];
                        if (memberName) {
                            isAllianceMember = members.indexOf(memberName) !== -1;
                        }
                        // Also check direct name match as fallback
                        if (!isAllianceMember) {
                            isAllianceMember = members.some(function(m) {
                                return mapName.indexOf(m) !== -1 || m.indexOf(mapName) !== -1;
                            });
                        }
                    }
                } else if (currentView === "compare") {
                    isSelected = selectedCountries.has(country);
                    isDisabled = selectedCountries.size >= MAX_COMPARE && !isSelected && policyData[country];
                }


                path.classList.remove("selected", "disabled", "alliance-member");
                if (isSelected) path.classList.add("selected");
                if (isDisabled) path.classList.add("disabled");
                if (isAllianceMember) path.classList.add("alliance-member");
            });
        }


        function showTooltip(event, countryName) {
            var displayName = displayNames[countryName] || countryName;
            tooltip.querySelector(".tooltip-title").textContent = displayName;


            var msg = "Click to select";
            if (currentView === "compare" && selectedCountries.size >= MAX_COMPARE && !selectedCountries.has(countryName)) {
                msg = "Max " + MAX_COMPARE + " countries selected";
            } else if (currentView === "alliance") {
                msg = policyData[countryName] ? "Click to view country" : "No country data available";
            }
            tooltip.querySelector(".tooltip-subtitle").textContent = msg;


            tooltip.style.left = (event.clientX + 15) + "px";
            tooltip.style.top = (event.clientY - 10) + "px";
            tooltip.classList.add("visible");
        }


        function hideTooltip() { tooltip.classList.remove("visible"); }


        function showAllianceMemberTooltip(event, mapName, memberName) {
            var allianceFullNames = {
                "NATO": "NATO",
                "AUKUS": "AUKUS", 
                "FVEY": "Five Eyes"
            };
            tooltip.querySelector(".tooltip-title").textContent = memberName;
            tooltip.querySelector(".tooltip-subtitle").textContent = allianceFullNames[selectedAlliance] + " member";
            tooltip.style.left = (event.clientX + 15) + "px";
            tooltip.style.top = (event.clientY - 10) + "px";
            tooltip.classList.add("visible");
        }


        async function initMap() {
            var width = 960;
            var height = 480;


            var svg = d3.select("#map-svg")
                .attr("width", "100%")
                .attr("height", height)
                .attr("viewBox", "0 0 " + width + " " + height)
                .attr("preserveAspectRatio", "xMidYMid meet");


            // Create a group for zoomable content
            var g = svg.append("g").attr("id", "map-group");


            var projection = d3.geoNaturalEarth1()
                .scale(180)
                .translate([width / 2, height / 2 + 25]);


            var path = d3.geoPath().projection(projection);


            // Add ocean background
            g.append("rect")
                .attr("class", "ocean")
                .attr("width", width)
                .attr("height", height);


            // Add graticule
            var graticule = d3.geoGraticule();
            g.append("path").datum(graticule).attr("class", "graticule").attr("d", path);


            // Setup zoom behavior
            mapZoom = d3.zoom()
                .scaleExtent([1, 8])
                .on("zoom", function(event) {
                    g.attr("transform", event.transform);
                });


            svg.call(mapZoom);


            // Zoom controls
            document.getElementById("zoom-in").addEventListener("click", function() {
                svg.transition().duration(300).call(mapZoom.scaleBy, 1.5);
            });


            document.getElementById("zoom-out").addEventListener("click", function() {
                svg.transition().duration(300).call(mapZoom.scaleBy, 0.67);
            });


            document.getElementById("zoom-reset").addEventListener("click", function() {
                svg.transition().duration(300).call(mapZoom.transform, d3.zoomIdentity);
            });


            try {
                var world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
                var countries = topojson.feature(world, world.objects.countries);


                var countryNames = {};
                world.objects.countries.geometries.forEach(function(geo) {
                    countryNames[geo.id] = geo.properties.name;
                });


                g.selectAll(".country-path")
                    .data(countries.features)
                    .enter()
                    .append("path")
                    .attr("class", function(d) {
                        var name = countryNames[d.id] || d.properties.name;
                        var mappedName = countryNameMap[name];
                        return "country-path" + (mappedName && policyData[mappedName] ? " has-data" : "");
                    })
                    .attr("d", path)
                    .attr("data-country", function(d) {
                        var name = countryNames[d.id] || d.properties.name;
                        return countryNameMap[name] || null;
                    })
                    .attr("data-map-name", function(d) {
                        return countryNames[d.id] || d.properties.name;
                    })
                    .on("click", function(event, d) {
                        var name = countryNames[d.id] || d.properties.name;
                        var mappedName = countryNameMap[name];
                        if (mappedName && policyData[mappedName]) {
                            if (currentView === "overview") {
                                selectOverviewCountry(mappedName);
                            } else if (currentView === "alliance") {
                                // Switch to Country Overview and select this country
                                switchToCountryOverview(mappedName);
                            } else {
                                if (selectedCountries.has(mappedName) || selectedCountries.size < MAX_COMPARE) {
                                    toggleCompareCountry(mappedName);
                                }
                            }
                        }
                    })
                    .on("mousemove", function(event, d) {
                        var name = countryNames[d.id] || d.properties.name;
                        var mappedName = countryNameMap[name];
                        
                        // Show tooltip for countries with data, or alliance members
                        if (mappedName && policyData[mappedName]) {
                            showTooltip(event, mappedName);
                        } else if (currentView === "alliance" && selectedAlliance) {
                            var memberName = allianceMemberMap[name];
                            if (memberName && allianceMembers[selectedAlliance].indexOf(memberName) !== -1) {
                                showAllianceMemberTooltip(event, name, memberName);
                            }
                        }
                    })
                    .on("mouseout", hideTooltip);


                document.getElementById("map-loading").style.display = "none";
                document.getElementById("map-svg").style.display = "block";

                // Initialize choropleth time slider after map is ready
                setTimeout(initMapTimeSlider, 100);

                // Auto-select removed


            } catch (error) {
                console.error("Error loading map:", error);
                document.getElementById("map-loading").innerHTML = '<span style="color: #d64045;">Error loading map. Please refresh.</span>';
            }
        }


        // ===== CHOROPLETH MAP TIME SLIDER =====
        var mapTimeSliderValue = 39; // Default to Q4 2025
        var mapAnimationInterval = null;
        var countryEntriesCumulative = {};
        var countryEntriesYearly = {};
        var mapViewMode = 'cumulative'; // 'cumulative' or 'yearly'
        
        // Calculate entries per country per quarter (both cumulative and yearly)
        function calculateCountryEntriesByQuarter() {
            var POLICY_AREAS = [
                "LAWS Employment/Deployment",
                "Adoption & Intent of Use",
                "Acquisition & Procurement",
                "Ethical Guidelines & Restrictions",
                "Technical Safety & Security Requirements",
                "Int'l Cooperation & Interoperability"
            ];
            
            // Initialize structures
            Object.keys(policyData).forEach(function(country) {
                countryEntriesCumulative[country] = {};
                countryEntriesYearly[country] = {};
                for (var q = 0; q <= 39; q++) {
                    countryEntriesCumulative[country][q] = 0;
                    countryEntriesYearly[country][q] = 0;
                }
            });
            
            // Count entries by quarter
            Object.keys(policyData).forEach(function(country) {
                var countryData = policyData[country];
                POLICY_AREAS.forEach(function(area) {
                    var areaData = countryData[area];
                    if (!areaData) return;
                    
                    ['legal_directives', 'policy_documents', 'public_statements'].forEach(function(type) {
                        if (areaData[type]) {
                            areaData[type].forEach(function(entry) {
                                var text = entry.text || '';
                                var yearMatch = text.match(/\(([A-Z][a-z]+)? ?(\d{4})\)/);
                                if (yearMatch) {
                                    var monthStr = yearMatch[1] || '';
                                    var year = parseInt(yearMatch[2]);
                                    
                                    // Determine quarter
                                    var quarter = 4; // Default to Q4
                                    var monthMap = {
                                        'Jan': 1, 'Feb': 1, 'Mar': 1,
                                        'Apr': 2, 'May': 2, 'Jun': 2,
                                        'Jul': 3, 'Aug': 3, 'Sep': 3,
                                        'Oct': 4, 'Nov': 4, 'Dec': 4,
                                        'January': 1, 'February': 1, 'March': 1,
                                        'April': 2, 'May': 2, 'June': 2,
                                        'July': 3, 'August': 3, 'September': 3,
                                        'October': 4, 'November': 4, 'December': 4
                                    };
                                    if (monthStr && monthMap[monthStr]) {
                                        quarter = monthMap[monthStr];
                                    }
                                    
                                    // Convert to quarter index (0 = Q1 2016, 39 = Q4 2025)
                                    if (year >= 2016 && year <= 2025) {
                                        var quarterIndex = (year - 2016) * 4 + (quarter - 1);
                                        
                                        // Yearly: only count in quarters of that year
                                        var yearStart = (year - 2016) * 4;
                                        var yearEnd = yearStart + 3;
                                        for (var q = yearStart; q <= yearEnd; q++) {
                                            countryEntriesYearly[country][q]++;
                                        }
                                        
                                        // Cumulative: add to this quarter and all subsequent quarters
                                        for (var qc = quarterIndex; qc <= 39; qc++) {
                                            countryEntriesCumulative[country][qc]++;
                                        }
                                    }
                                }
                            });
                        }
                    });
                });
            });
        }
        
        // Get color for entry count (different scales for cumulative vs yearly)
        function getEntryColor(count, mode) {
            if (count === 0) return null; // No data
            
            // Color scale: light teal to dark teal
            // Different thresholds for yearly (lower numbers) vs cumulative (higher numbers)
            var colors;
            if (mode === 'yearly') {
                colors = [
                    { threshold: 1, color: '#d4f0f0' },
                    { threshold: 3, color: '#a8e0e0' },
                    { threshold: 5, color: '#7ed0d0' },
                    { threshold: 8, color: '#54c0c0' },
                    { threshold: 12, color: '#2ab0b0' },
                    { threshold: 18, color: '#0d9090' },
                    { threshold: 25, color: '#0d7377' },
                    { threshold: Infinity, color: '#1a5a5c' }
                ];
            } else {
                colors = [
                    { threshold: 1, color: '#d4f0f0' },
                    { threshold: 5, color: '#a8e0e0' },
                    { threshold: 10, color: '#7ed0d0' },
                    { threshold: 20, color: '#54c0c0' },
                    { threshold: 30, color: '#2ab0b0' },
                    { threshold: 40, color: '#0d9090' },
                    { threshold: 50, color: '#0d7377' },
                    { threshold: Infinity, color: '#1a5a5c' }
                ];
            }
            
            for (var i = 0; i < colors.length; i++) {
                if (count < colors[i].threshold) {
                    return colors[i].color;
                }
            }
            return colors[colors.length - 1].color;
        }
        
        // Update map colors based on current time slider
        function updateMapChoropleth(quarterIndex) {
            var countriesWithData = 0;
            var totalEntries = 0;
            var maxCountry = '';
            var maxCount = 0;
            
            // Select data source based on view mode
            var dataSource = mapViewMode === 'cumulative' ? countryEntriesCumulative : countryEntriesYearly;
            
            document.querySelectorAll('.country-path').forEach(function(path) {
                var country = path.getAttribute('data-country');
                
                if (country && dataSource[country]) {
                    var count = dataSource[country][quarterIndex] || 0;
                    
                    if (count > 0) {
                        var color = getEntryColor(count, mapViewMode);
                        path.style.fill = color;
                        path.classList.add('has-data');
                        countriesWithData++;
                        totalEntries += count;
                        
                        if (count > maxCount) {
                            maxCount = count;
                            maxCountry = country;
                        }
                    } else {
                        path.style.fill = '';
                        path.classList.remove('has-data');
                    }
                }
            });
            
            // Update stats label based on mode
            var entriesLabel = mapViewMode === 'cumulative' ? 'Total Entries' : 'Entries This Year';
            document.querySelector('#map-stat-entries + .map-stat-label').textContent = entriesLabel;
            
            // Update stats
            document.getElementById('map-stat-countries').textContent = countriesWithData;
            document.getElementById('map-stat-entries').textContent = totalEntries;
            document.getElementById('map-stat-top').textContent = maxCountry ? (displayNames[maxCountry] || maxCountry) : '—';
        }
        
        // Convert quarter index to display string (year only)
        function quarterIndexToDisplay(index) {
            var year = 2016 + Math.floor(index / 4);
            return year.toString();
        }
        
        // Initialize time slider
        function initMapTimeSlider() {
            calculateCountryEntriesByQuarter();
            
            var slider = document.getElementById('map-time-slider');
            var display = document.getElementById('map-time-display');
            var ticksContainer = document.getElementById('map-time-ticks');
            var playBtn = document.getElementById('map-play-btn');
            
            if (!slider || !ticksContainer) return;
            
            // Create tick marks (years with quarter subdivisions)
            ticksContainer.innerHTML = '';
            for (var year = 2016; year <= 2025; year++) {
                var yearTick = document.createElement('div');
                yearTick.className = 'map-time-tick';
                yearTick.innerHTML = '<div class="map-time-tick-mark"></div>' +
                    '<span class="map-time-tick-label">' + year + '</span>';
                ticksContainer.appendChild(yearTick);
                
                // Add quarter ticks (except after last year)
                if (year < 2025) {
                    for (var q = 0; q < 3; q++) {
                        var quarterTick = document.createElement('div');
                        quarterTick.className = 'map-time-tick';
                        quarterTick.innerHTML = '<div class="map-time-tick-mark quarter"></div>';
                        ticksContainer.appendChild(quarterTick);
                    }
                }
            }
            
            // Slider change handler
            slider.addEventListener('input', function() {
                mapTimeSliderValue = parseInt(this.value);
                display.textContent = quarterIndexToDisplay(mapTimeSliderValue);
                updateMapChoropleth(mapTimeSliderValue);
            });
            
            // Play button handler
            playBtn.addEventListener('click', function() {
                if (mapAnimationInterval) {
                    // Stop animation
                    clearInterval(mapAnimationInterval);
                    mapAnimationInterval = null;
                    playBtn.classList.remove('playing');
                    playBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                } else {
                    // Start animation
                    if (mapTimeSliderValue >= 39) {
                        mapTimeSliderValue = 0;
                    }
                    
                    playBtn.classList.add('playing');
                    playBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
                    
                    mapAnimationInterval = setInterval(function() {
                        mapTimeSliderValue++;
                        if (mapTimeSliderValue > 39) {
                            mapTimeSliderValue = 39;
                            clearInterval(mapAnimationInterval);
                            mapAnimationInterval = null;
                            playBtn.classList.remove('playing');
                            playBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                        }
                        slider.value = mapTimeSliderValue;
                        display.textContent = quarterIndexToDisplay(mapTimeSliderValue);
                        updateMapChoropleth(mapTimeSliderValue);
                    }, 300);
                }
            });
            
            // View mode toggle handlers
            var cumulativeBtn = document.getElementById('map-view-cumulative');
            var yearlyBtn = document.getElementById('map-view-yearly');
            var legendLabels = document.querySelectorAll('.map-legend-label');
            
            function updateLegendLabels() {
                if (mapViewMode === 'yearly') {
                    // Yearly scale labels
                    var yearlyLabels = ['25+', '18', '12', '8', '5', '0'];
                    legendLabels.forEach(function(label, idx) {
                        label.textContent = yearlyLabels[idx] || '';
                    });
                } else {
                    // Cumulative scale labels
                    var cumulativeLabels = ['50+', '40', '30', '20', '10', '0'];
                    legendLabels.forEach(function(label, idx) {
                        label.textContent = cumulativeLabels[idx] || '';
                    });
                }
            }
            
            if (cumulativeBtn) {
                cumulativeBtn.addEventListener('click', function() {
                    mapViewMode = 'cumulative';
                    cumulativeBtn.classList.add('active');
                    yearlyBtn.classList.remove('active');
                    updateLegendLabels();
                    updateMapChoropleth(mapTimeSliderValue);
                });
            }
            
            if (yearlyBtn) {
                yearlyBtn.addEventListener('click', function() {
                    mapViewMode = 'yearly';
                    yearlyBtn.classList.add('active');
                    cumulativeBtn.classList.remove('active');
                    updateLegendLabels();
                    updateMapChoropleth(mapTimeSliderValue);
                });
            }
            
            // Initial update
            updateMapChoropleth(mapTimeSliderValue);
        }


        buildDropdowns();
            initCountrySearch();
        buildPolicyAreaDropdown();
        
        // Check if D3 and TopoJSON loaded successfully before initializing map
        if (typeof d3 !== 'undefined' && typeof topojson !== 'undefined') {
            initMap().catch(function(error) {
                console.error("Map initialization error:", error);
                document.getElementById("map-loading").innerHTML = '<span style="color: rgba(255,255,255,0.7);">Could not load map.<br>Use country chips below to navigate.</span>';
                // Auto-select removed
            });
        } else {
            // Show fallback message if libraries didn't load
            document.getElementById("map-loading").innerHTML = '<span style="color: rgba(255,255,255,0.7);">Map requires external libraries.<br>Use country chips below to navigate.</span>';
            // Auto-select USA after a brief delay
            // Auto-select removed
        }

        
        // ===== MOMENTUM TRACKER =====
        function calculateMomentumData() {
            var momentumStats = [];
            var POLICY_AREAS = [
                "LAWS Employment/Deployment",
                "Adoption & Intent of Use",
                "Acquisition & Procurement",
                "Ethical Guidelines & Restrictions",
                "Technical Safety & Security Requirements",
                "Int'l Cooperation & Interoperability"
            ];
            
            // Region mapping for tooltip display
            var regionMap = {
                "USA": "Americas", "Canada": "Americas", "Brazil": "Americas", "Colombia": "Americas",
                "UK": "Europe", "France": "Europe", "Germany": "Europe", "Italy": "Europe", "Spain": "Europe",
                "Netherlands": "Europe", "Belgium": "Europe", "Poland": "Europe", "Norway": "Europe",
                "Sweden": "Europe", "Finland": "Europe", "Denmark": "Europe", "Estonia": "Europe",
                "Latvia": "Europe", "Lithuania": "Europe", "Greece": "Europe", "Hungary": "Europe",
                "Croatia": "Europe", "Bulgaria": "Europe", "Czechia": "Europe",
                "Russia": "Europe", "Ukraine": "Europe", "Turkey": "Europe",
                "China": "Asia-Pacific", "Japan": "Asia-Pacific", "South Korea": "Asia-Pacific",
                "Singapore": "Asia-Pacific", "India": "Asia-Pacific", "Pakistan": "Asia-Pacific",
                "Australia": "Asia-Pacific", "North Korea": "Asia-Pacific",
                "Israel": "Middle East", "UAE": "Middle East", "Iran": "Middle East",
                "Iraq": "Middle East", "Egypt": "Middle East", "Morocco": "Middle East",
                "Algeria": "Africa", "South Africa": "Africa",
                "Armenia": "Europe", "Azerbaijan": "Europe"
            };
            
            var regionColors = {
                "Americas": "#d64045",
                "Europe": "#1a2744",
                "Asia-Pacific": "#0d7377",
                "Middle East": "#e07020",
                "Africa": "#6b3074"
            };
            
            Object.keys(policyData).forEach(function(country) {
                var countryData = policyData[country];
                var recentEntries = 0; // 2023-2025
                var historicalEntries = 0; // before 2023
                var totalEntries = 0;
                
                POLICY_AREAS.forEach(function(area) {
                    var areaData = countryData[area];
                    if (areaData) {
                        ['legal_directives', 'policy_documents', 'public_statements'].forEach(function(type) {
                            if (areaData[type]) {
                                areaData[type].forEach(function(entry) {
                                    var text = entry.text || '';
                                    var yearMatch = text.match(/\(([A-Z][a-z]+ )?(\d{4})\)/);
                                    totalEntries++;
                                    if (yearMatch) {
                                        var year = parseInt(yearMatch[2]);
                                        if (year >= 2023) {
                                            recentEntries++;
                                        } else {
                                            historicalEntries++;
                                        }
                                    } else {
                                        historicalEntries++; // Assume older if no date
                                    }
                                });
                            }
                        });
                    }
                });
                
                if (totalEntries > 0) {
                    var recentRate = recentEntries / Math.max(1, totalEntries);
                    var momentum;
                    var color;
                    
                    if (recentEntries >= 5 && recentRate > 0.5) {
                        momentum = "accelerating";
                        color = "#4a9d5b";
                    } else if (totalEntries >= 5 && recentRate >= 0.3) {
                        momentum = "steady";
                        color = "#0d7377";
                    } else if (recentEntries >= 2 && totalEntries < 8) {
                        momentum = "emerging";
                        color = "#e07020";
                    } else {
                        momentum = "dormant";
                        color = "#7a8a9a";
                    }
                    
                    var region = regionMap[country] || "Other";
                    var regionColor = regionColors[region] || "#888888";
                    
                    momentumStats.push({
                        country: country,
                        displayName: displayNames[country] || country,
                        total: totalEntries,
                        recent: recentEntries,
                        historical: historicalEntries,
                        recentRate: recentRate,
                        momentum: momentum,
                        color: color,
                        region: region,
                        regionColor: regionColor
                    });
                }
            });
            
            return momentumStats;
        }
        
        function renderMomentumChart() {
            var data = calculateMomentumData();
            var container = document.getElementById("momentum-chart");
            if (!container) return;
            
            container.innerHTML = '';
            
            var width = container.offsetWidth || 300;
            var height = 320;
            var margin = { top: 20, right: 20, bottom: 45, left: 55 };
            var plotWidth = width - margin.left - margin.right;
            var plotHeight = height - margin.top - margin.bottom;
            
            // Calculate data extents with padding
            var maxTotal = Math.max.apply(null, data.map(function(d) { return d.total; }));
            var maxRecent = Math.max.apply(null, data.map(function(d) { return d.recent; }));
            maxTotal = maxTotal * 1.15; // Add 15% padding
            maxRecent = maxRecent * 1.15; // Add 15% padding
            
            // Zoom state
            var zoomLevel = 1;
            var panX = 0;
            var panY = 0;
            var isDragging = false;
            var dragStartX = 0;
            var dragStartY = 0;
            var dragStartPanX = 0;
            var dragStartPanY = 0;
            
            // Create SVG
            var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", width);
            svg.setAttribute("height", height);
            svg.style.cursor = "grab";
            container.appendChild(svg);
            
            // Create clip path for plot area
            var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            var clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
            clipPath.setAttribute("id", "momentum-clip");
            var clipRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            clipRect.setAttribute("x", margin.left);
            clipRect.setAttribute("y", margin.top);
            clipRect.setAttribute("width", plotWidth);
            clipRect.setAttribute("height", plotHeight);
            clipPath.appendChild(clipRect);
            defs.appendChild(clipPath);
            svg.appendChild(defs);
            
            // Background for plot area
            var plotBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            plotBg.setAttribute("x", margin.left);
            plotBg.setAttribute("y", margin.top);
            plotBg.setAttribute("width", plotWidth);
            plotBg.setAttribute("height", plotHeight);
            plotBg.setAttribute("fill", "white");
            svg.appendChild(plotBg);
            
            // Groups for layering
            var gridGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            var axisGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            var dotsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            dotsGroup.setAttribute("clip-path", "url(#momentum-clip)");
            svg.appendChild(gridGroup);
            svg.appendChild(axisGroup);
            svg.appendChild(dotsGroup);
            
            // Calculate pan limits to prevent scrolling past 0
            function getPanLimits() {
                // At zoom level 1, pan should be 0
                // At higher zoom, limit pan so that 0,0 origin stays visible
                var maxPanX = (zoomLevel - 1) * plotWidth / 2;
                var maxPanY = (zoomLevel - 1) * plotHeight / 2;
                return {
                    minX: -maxPanX,
                    maxX: maxPanX,
                    minY: -maxPanY,
                    maxY: maxPanY
                };
            }
            
            function constrainPan() {
                var limits = getPanLimits();
                panX = Math.max(limits.minX, Math.min(limits.maxX, panX));
                panY = Math.max(limits.minY, Math.min(limits.maxY, panY));
            }
            
            function scaleX(recent) {
                var baseX = margin.left + (recent / maxRecent) * plotWidth;
                return margin.left + (baseX - margin.left - plotWidth/2) * zoomLevel + plotWidth/2 + panX;
            }
            function scaleY(total) {
                var baseY = margin.top + plotHeight - (total / maxTotal) * plotHeight;
                return margin.top + (baseY - margin.top - plotHeight/2) * zoomLevel + plotHeight/2 + panY;
            }
            
            function renderChart() {
                // Clear groups
                gridGroup.innerHTML = '';
                axisGroup.innerHTML = '';
                dotsGroup.innerHTML = '';
                
                // Grid lines and tick labels
                var yTicks = 5;
                for (var i = 0; i <= yTicks; i++) {
                    var val = (maxTotal / yTicks) * (yTicks - i);
                    var y = scaleY(val);
                    
                    if (y >= margin.top && y <= margin.top + plotHeight) {
                        // Grid line
                        var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                        line.setAttribute("x1", margin.left);
                        line.setAttribute("y1", y);
                        line.setAttribute("x2", margin.left + plotWidth);
                        line.setAttribute("y2", y);
                        line.setAttribute("stroke", "#e8ebef");
                        line.setAttribute("stroke-width", "1");
                        gridGroup.appendChild(line);
                        
                        // Y-axis tick label
                        var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                        label.setAttribute("x", margin.left - 8);
                        label.setAttribute("y", y + 3);
                        label.setAttribute("text-anchor", "end");
                        label.setAttribute("font-size", "9");
                        label.setAttribute("fill", "#7a8a9a");
                        label.textContent = Math.round(val);
                        axisGroup.appendChild(label);
                    }
                }
                
                var xTicks = 5;
                for (var j = 0; j <= xTicks; j++) {
                    var xVal = (maxRecent / xTicks) * j;
                    var x = scaleX(xVal);
                    
                    if (x >= margin.left && x <= margin.left + plotWidth) {
                        // Grid line
                        var vline = document.createElementNS("http://www.w3.org/2000/svg", "line");
                        vline.setAttribute("x1", x);
                        vline.setAttribute("y1", margin.top);
                        vline.setAttribute("x2", x);
                        vline.setAttribute("y2", margin.top + plotHeight);
                        vline.setAttribute("stroke", "#e8ebef");
                        vline.setAttribute("stroke-width", "1");
                        gridGroup.appendChild(vline);
                        
                        // X-axis tick label
                        var xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                        xLabel.setAttribute("x", x);
                        xLabel.setAttribute("y", margin.top + plotHeight + 15);
                        xLabel.setAttribute("text-anchor", "middle");
                        xLabel.setAttribute("font-size", "9");
                        xLabel.setAttribute("fill", "#7a8a9a");
                        xLabel.textContent = Math.round(xVal);
                        axisGroup.appendChild(xLabel);
                    }
                }
                
                // Axis labels
                var xAxisLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                xAxisLabel.setAttribute("x", margin.left + plotWidth / 2);
                xAxisLabel.setAttribute("y", height - 8);
                xAxisLabel.setAttribute("text-anchor", "middle");
                xAxisLabel.setAttribute("font-size", "10");
                xAxisLabel.setAttribute("fill", "#1a2744");
                xAxisLabel.setAttribute("font-weight", "600");
                xAxisLabel.textContent = "Recent Entries (2023-2025)";
                axisGroup.appendChild(xAxisLabel);
                
                var yAxisLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                yAxisLabel.setAttribute("x", 14);
                yAxisLabel.setAttribute("y", margin.top + plotHeight / 2);
                yAxisLabel.setAttribute("text-anchor", "middle");
                yAxisLabel.setAttribute("font-size", "10");
                yAxisLabel.setAttribute("fill", "#1a2744");
                yAxisLabel.setAttribute("font-weight", "600");
                yAxisLabel.setAttribute("transform", "rotate(-90, 14, " + (margin.top + plotHeight / 2) + ")");
                yAxisLabel.textContent = "Total Entries";
                axisGroup.appendChild(yAxisLabel);
                
                // Axis lines
                var xAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
                xAxis.setAttribute("x1", margin.left);
                xAxis.setAttribute("y1", margin.top + plotHeight);
                xAxis.setAttribute("x2", margin.left + plotWidth);
                xAxis.setAttribute("y2", margin.top + plotHeight);
                xAxis.setAttribute("stroke", "#1a2744");
                xAxis.setAttribute("stroke-width", "1.5");
                axisGroup.appendChild(xAxis);
                
                var yAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
                yAxis.setAttribute("x1", margin.left);
                yAxis.setAttribute("y1", margin.top);
                yAxis.setAttribute("x2", margin.left);
                yAxis.setAttribute("y2", margin.top + plotHeight);
                yAxis.setAttribute("stroke", "#1a2744");
                yAxis.setAttribute("stroke-width", "1.5");
                axisGroup.appendChild(yAxis);
                
                // Plot dots - sort by total so high-value countries render on top
                var sortedData = data.slice().sort(function(a, b) {
                    return a.total - b.total;
                });
                
                sortedData.forEach(function(item) {
                    var cx = scaleX(item.recent);
                    var cy = scaleY(item.total);
                    var r = 4 * Math.sqrt(zoomLevel);
                    
                    // Only render if in visible area
                    if (cx < margin.left - r || cx > margin.left + plotWidth + r ||
                        cy < margin.top - r || cy > margin.top + plotHeight + r) {
                        return;
                    }
                    
                    var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    circle.setAttribute("cx", cx);
                    circle.setAttribute("cy", cy);
                    circle.setAttribute("r", r);
                    circle.setAttribute("fill", item.color);
                    circle.setAttribute("fill-opacity", "0.85");
                    circle.setAttribute("stroke", "white");
                    circle.setAttribute("stroke-width", "1");
                    circle.setAttribute("cursor", "pointer");
                    circle.style.transition = "r 0.15s, fill-opacity 0.15s";
                    
                    // Tooltip events
                    circle.addEventListener("mouseenter", function(e) {
                        this.setAttribute("r", r * 1.5);
                        this.setAttribute("fill-opacity", "1");
                        
                        var tooltip = document.getElementById("momentum-tooltip");
                        var statusLabel = item.momentum.charAt(0).toUpperCase() + item.momentum.slice(1);
                        tooltip.innerHTML = '<strong>' + item.displayName + '</strong><br>' +
                            'Total: ' + item.total + ' entries<br>' +
                            'Recent (2023+): ' + item.recent + '<br>' +
                            'Status: <span class="tooltip-status ' + item.momentum + '">' + statusLabel + '</span>';
                        tooltip.classList.add("visible");
                    });
                    
                    circle.addEventListener("mousemove", function(e) {
                        var tooltip = document.getElementById("momentum-tooltip");
                        var tooltipRect = tooltip.getBoundingClientRect();
                        var viewportWidth = window.innerWidth;
                        var viewportHeight = window.innerHeight;
                        
                        var left = e.clientX + 15;
                        var top = e.clientY - 10;
                        
                        // Keep tooltip in viewport
                        if (left + tooltipRect.width > viewportWidth - 10) {
                            left = e.clientX - tooltipRect.width - 15;
                        }
                        if (top + tooltipRect.height > viewportHeight - 10) {
                            top = e.clientY - tooltipRect.height - 10;
                        }
                        if (top < 10) top = 10;
                        
                        tooltip.style.left = left + "px";
                        tooltip.style.top = top + "px";
                    });
                    
                    circle.addEventListener("mouseleave", function() {
                        this.setAttribute("r", r);
                        this.setAttribute("fill-opacity", "0.85");
                        document.getElementById("momentum-tooltip").classList.remove("visible");
                    });
                    
                    circle.addEventListener("click", function(e) {
                        e.stopPropagation();
                        selectOverviewCountry(item.country);
                    });
                    
                    dotsGroup.appendChild(circle);
                });
            }
            
            // Initial render
            renderChart();
            
            // Zoom controls
            var zoomInBtn = document.getElementById("momentum-zoom-in");
            var zoomOutBtn = document.getElementById("momentum-zoom-out");
            var zoomResetBtn = document.getElementById("momentum-zoom-reset");
            
            if (zoomInBtn) {
                zoomInBtn.addEventListener("click", function() {
                    zoomLevel = Math.min(zoomLevel * 1.5, 10);
                    constrainPan();
                    renderChart();
                    if (window.momentumReapplyHighlight) setTimeout(window.momentumReapplyHighlight, 20);
                });
            }
            
            if (zoomOutBtn) {
                zoomOutBtn.addEventListener("click", function() {
                    zoomLevel = Math.max(zoomLevel / 1.5, 1);
                    constrainPan();
                    renderChart();
                    if (window.momentumReapplyHighlight) setTimeout(window.momentumReapplyHighlight, 20);
                });
            }
            
            if (zoomResetBtn) {
                zoomResetBtn.addEventListener("click", function() {
                    zoomLevel = 1;
                    panX = 0;
                    panY = 0;
                    renderChart();
                    if (window.momentumReapplyHighlight) setTimeout(window.momentumReapplyHighlight, 20);
                });
            }
            
            // Mouse wheel zoom - zooms toward mouse position
            container.addEventListener("wheel", function(e) {
                e.preventDefault();
                var delta = e.deltaY > 0 ? 0.9 : 1.1;
                var newZoom = Math.max(1, Math.min(10, zoomLevel * delta));
                
                if (newZoom !== zoomLevel) {
                    // Get mouse position relative to plot area center
                    var rect = container.getBoundingClientRect();
                    var mouseX = e.clientX - rect.left;
                    var mouseY = e.clientY - rect.top;
                    
                    // Calculate offset from plot center
                    var plotCenterX = margin.left + plotWidth / 2;
                    var plotCenterY = margin.top + plotHeight / 2;
                    var offsetX = mouseX - plotCenterX;
                    var offsetY = mouseY - plotCenterY;
                    
                    // Adjust pan so the point under mouse stays fixed
                    var zoomRatio = newZoom / zoomLevel;
                    panX = panX * zoomRatio - offsetX * (zoomRatio - 1);
                    panY = panY * zoomRatio - offsetY * (zoomRatio - 1);
                    
                    zoomLevel = newZoom;
                    constrainPan();
                    renderChart();
                    if (window.momentumReapplyHighlight) setTimeout(window.momentumReapplyHighlight, 20);
                }
            }, { passive: false });
            
            // Pan with mouse drag
            container.addEventListener("mousedown", function(e) {
                if (e.target.tagName === "circle") return;
                isDragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                dragStartPanX = panX;
                dragStartPanY = panY;
                svg.style.cursor = "grabbing";
            });
            
            document.addEventListener("mousemove", function(e) {
                if (!isDragging) return;
                var dx = e.clientX - dragStartX;
                var dy = e.clientY - dragStartY;
                panX = dragStartPanX + dx;
                panY = dragStartPanY + dy;
                constrainPan();
                renderChart();
            });
            
            document.addEventListener("mouseup", function() {
                if (isDragging) {
                    isDragging = false;
                    svg.style.cursor = "grab";
                    if (window.momentumReapplyHighlight) setTimeout(window.momentumReapplyHighlight, 20);
                }
            });
            
            // Store data and elements for search functionality
            window.momentumChartData = {
                data: data,
                dotsGroup: dotsGroup,
                scaleX: scaleX,
                scaleY: scaleY,
                margin: margin,
                plotWidth: plotWidth,
                plotHeight: plotHeight,
                zoomLevel: function() { return zoomLevel; },
                activeSearch: null
            };
        }
        
        // ===== MOMENTUM CHART SEARCH =====
        (function() {
            // Country aliases for common names
            var countryAliases = {
                'russia': 'Russian Federation',
                'uk': 'United Kingdom',
                'britain': 'United Kingdom',
                'great britain': 'United Kingdom',
                'england': 'United Kingdom',
                'usa': 'United States',
                'us': 'United States',
                'america': 'United States',
                'uae': 'United Arab Emirates',
                'emirates': 'United Arab Emirates',
                'south korea': 'Korea, Republic of',
                'korea': 'Korea, Republic of',
                'rok': 'Korea, Republic of',
                'czech': 'Czech Republic',
                'czechia': 'Czech Republic',
                'netherlands': 'The Netherlands',
                'holland': 'The Netherlands',
                'ksa': 'Saudi Arabia',
                'prc': 'China',
                'roc': 'Taiwan'
            };
            
            function findCountry(searchTerm) {
                if (!window.momentumChartData) return null;
                var data = window.momentumChartData.data;
                var term = searchTerm.toLowerCase().trim();
                
                // Check aliases first
                if (countryAliases[term]) {
                    var aliasTarget = countryAliases[term];
                    for (var i = 0; i < data.length; i++) {
                        if (data[i].displayName === aliasTarget || data[i].country === aliasTarget) {
                            return data[i];
                        }
                    }
                }
                
                // Partial match on country name
                for (var i = 0; i < data.length; i++) {
                    var name = data[i].displayName.toLowerCase();
                    var countryId = data[i].country.toLowerCase();
                    if (name.indexOf(term) !== -1 || countryId.indexOf(term) !== -1) {
                        return data[i];
                    }
                }
                
                return null;
            }
            
            function highlightCountry(item) {
                if (!window.momentumChartData) return;
                
                // Store active search for re-apply after zoom/pan
                window.momentumChartData.activeSearch = item;
                
                var chartData = window.momentumChartData;
                var dotsGroup = chartData.dotsGroup;
                var scaleX = chartData.scaleX;
                var scaleY = chartData.scaleY;
                var zoomLevel = chartData.zoomLevel();
                
                // Remove any existing highlight
                var existingHighlight = document.getElementById('momentum-highlight-group');
                if (existingHighlight) existingHighlight.remove();
                
                // Get position
                var cx = scaleX(item.recent);
                var cy = scaleY(item.total);
                var r = 4 * Math.sqrt(zoomLevel);
                
                // Create highlight group
                var highlightGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                highlightGroup.setAttribute("id", "momentum-highlight-group");
                
                // Pulsing ring
                var ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                ring.setAttribute("cx", cx);
                ring.setAttribute("cy", cy);
                ring.setAttribute("r", r * 2.5);
                ring.setAttribute("fill", "none");
                ring.setAttribute("stroke", item.color);
                ring.setAttribute("stroke-width", "2");
                ring.setAttribute("stroke-opacity", "0.6");
                
                // Add pulse animation
                var animR = document.createElementNS("http://www.w3.org/2000/svg", "animate");
                animR.setAttribute("attributeName", "r");
                animR.setAttribute("from", r * 1.5);
                animR.setAttribute("to", r * 3);
                animR.setAttribute("dur", "1s");
                animR.setAttribute("repeatCount", "indefinite");
                ring.appendChild(animR);
                
                var animOpacity = document.createElementNS("http://www.w3.org/2000/svg", "animate");
                animOpacity.setAttribute("attributeName", "stroke-opacity");
                animOpacity.setAttribute("from", "0.8");
                animOpacity.setAttribute("to", "0");
                animOpacity.setAttribute("dur", "1s");
                animOpacity.setAttribute("repeatCount", "indefinite");
                ring.appendChild(animOpacity);
                
                highlightGroup.appendChild(ring);
                
                // Highlighted dot
                var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                dot.setAttribute("cx", cx);
                dot.setAttribute("cy", cy);
                dot.setAttribute("r", r * 1.8);
                dot.setAttribute("fill", item.color);
                dot.setAttribute("stroke", "white");
                dot.setAttribute("stroke-width", "2");
                highlightGroup.appendChild(dot);
                
                // Label background
                var labelText = item.displayName;
                var labelWidth = labelText.length * 6.5 + 16;
                var labelHeight = 20;
                var labelX = cx + r * 2 + 8;
                var labelY = cy - labelHeight / 2;
                
                // Adjust if label would go off right edge
                var container = document.getElementById("momentum-chart");
                if (container && labelX + labelWidth > container.offsetWidth - 20) {
                    labelX = cx - r * 2 - labelWidth - 8;
                }
                
                var labelBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                labelBg.setAttribute("x", labelX);
                labelBg.setAttribute("y", labelY);
                labelBg.setAttribute("width", labelWidth);
                labelBg.setAttribute("height", labelHeight);
                labelBg.setAttribute("rx", "4");
                labelBg.setAttribute("fill", "white");
                labelBg.setAttribute("stroke", item.color);
                labelBg.setAttribute("stroke-width", "1.5");
                labelBg.setAttribute("filter", "drop-shadow(0 1px 3px rgba(0,0,0,0.15))");
                highlightGroup.appendChild(labelBg);
                
                // Label text
                var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                label.setAttribute("x", labelX + 8);
                label.setAttribute("y", labelY + 14);
                label.setAttribute("font-family", "Inter, sans-serif");
                label.setAttribute("font-size", "11");
                label.setAttribute("font-weight", "600");
                label.setAttribute("fill", "#1a2744");
                label.textContent = labelText;
                highlightGroup.appendChild(label);
                
                dotsGroup.appendChild(highlightGroup);
                
                // Show the hover tooltip
                var tooltip = document.getElementById("momentum-tooltip");
                if (tooltip && container) {
                    var statusLabel = item.momentum.charAt(0).toUpperCase() + item.momentum.slice(1);
                    tooltip.innerHTML = '<strong>' + item.displayName + '</strong><br>' +
                        'Total: ' + item.total + ' entries<br>' +
                        'Recent (2023+): ' + item.recent + '<br>' +
                        'Status: <span class="tooltip-status ' + item.momentum + '">' + statusLabel + '</span>';
                    tooltip.classList.add("visible");
                    
                    // Position tooltip near the highlighted dot
                    var containerRect = container.getBoundingClientRect();
                    var tooltipLeft = containerRect.left + cx + 20;
                    var tooltipTop = containerRect.top + cy - 30 + window.scrollY;
                    
                    // Keep tooltip in viewport
                    if (tooltipLeft + 150 > window.innerWidth - 10) {
                        tooltipLeft = containerRect.left + cx - 170;
                    }
                    
                    tooltip.style.left = tooltipLeft + "px";
                    tooltip.style.top = tooltipTop + "px";
                }
            }
            
            function clearHighlight() {
                var existingHighlight = document.getElementById('momentum-highlight-group');
                if (existingHighlight) existingHighlight.remove();
                
                var tooltip = document.getElementById("momentum-tooltip");
                if (tooltip) tooltip.classList.remove("visible");
                
                // Clear active search
                if (window.momentumChartData) {
                    window.momentumChartData.activeSearch = null;
                }
            }
            
            // Function to re-apply highlight after zoom/pan
            window.momentumReapplyHighlight = function() {
                if (window.momentumChartData && window.momentumChartData.activeSearch) {
                    highlightCountry(window.momentumChartData.activeSearch);
                }
            };
            
            // Set up search input handler
            document.addEventListener('DOMContentLoaded', function() {
                var searchInput = document.getElementById('momentum-country-search');
                if (!searchInput) return;
                
                searchInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        var term = this.value.trim();
                        if (!term) {
                            clearHighlight();
                            return;
                        }
                        
                        var found = findCountry(term);
                        if (found) {
                            highlightCountry(found);
                            this.style.borderColor = '';
                        } else {
                            clearHighlight();
                            this.style.borderColor = '#e63946';
                            setTimeout(function() {
                                searchInput.style.borderColor = '';
                            }, 1500);
                        }
                    }
                });
                
                // Clear highlight when input is cleared
                searchInput.addEventListener('input', function() {
                    if (!this.value.trim()) {
                        clearHighlight();
                    }
                });
                
                // Clear search and highlight when clicking on chart
                var chartContainer = document.getElementById('momentum-chart');
                if (chartContainer) {
                    chartContainer.addEventListener('click', function(e) {
                        // Don't clear if clicking on a country dot (let that handler work)
                        if (e.target.tagName === 'circle') return;
                        
                        searchInput.value = '';
                        searchInput.style.borderColor = '';
                        clearHighlight();
                    });
                }
            });
        })();
        
        // ===== POLICY GROWTH CHART =====
        function renderPolicyGrowthChart() {
            var container = document.getElementById("policy-growth-chart");
            if (!container) return;
            
            container.innerHTML = '';
            
            // Calculate policy counts by year, quarter, and dimension
            var quarterlyData = {};
            var years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
            var quarters = [1, 2, 3, 4];
            var dims = ['LAWS', 'Adoption', 'Procurement', 'Safety', 'Ethics', 'Interoperability'];
            var dimLabels = {
                'LAWS': 'LAWS Employment',
                'Adoption': 'Adoption & Intent',
                'Procurement': 'Procurement',
                'Safety': 'Safety & Security',
                'Ethics': 'Ethics',
                'Interoperability': 'Interoperability'
            };
            var colors = {
                'LAWS': '#e63946',
                'Adoption': '#457b9d',
                'Procurement': '#2a9d8f',
                'Safety': '#e9c46a',
                'Ethics': '#a855f7',
                'Interoperability': '#14b8a6'
            };
            
            // Map full area names to short names
            var areaToShort = {
                'LAWS Employment/Deployment': 'LAWS',
                'Adoption & Intent of Use': 'Adoption',
                'Acquisition & Procurement': 'Procurement',
                'Technical Safety & Security Requirements': 'Safety',
                'Ethical Guidelines & Restrictions': 'Ethics',
                "Int'l Cooperation & Interoperability": 'Interoperability'
            };
            
            // Month to quarter mapping
            var monthToQuarter = {
                'Jan': 1, 'January': 1,
                'Feb': 1, 'February': 1,
                'Mar': 1, 'March': 1,
                'Apr': 2, 'April': 2,
                'May': 2,
                'Jun': 2, 'June': 2,
                'Jul': 3, 'July': 3,
                'Aug': 3, 'August': 3,
                'Sep': 3, 'September': 3,
                'Oct': 4, 'October': 4,
                'Nov': 4, 'November': 4,
                'Dec': 4, 'December': 4
            };
            
            var POLICY_AREAS = [
                "LAWS Employment/Deployment",
                "Adoption & Intent of Use",
                "Acquisition & Procurement",
                "Technical Safety & Security Requirements",
                "Ethical Guidelines & Restrictions",
                "Int'l Cooperation & Interoperability"
            ];
            
            // Initialize data structure
            years.forEach(function(y) {
                quarterlyData[y] = {};
                quarters.forEach(function(q) {
                    quarterlyData[y][q] = {};
                    dims.forEach(function(d) { quarterlyData[y][q][d] = 0; });
                });
            });
            
            // Count policies from policyData structure
            Object.keys(policyData).forEach(function(country) {
                var countryData = policyData[country];
                
                POLICY_AREAS.forEach(function(area) {
                    var areaData = countryData[area];
                    var shortName = areaToShort[area];
                    
                    if (areaData) {
                        ['legal_directives', 'policy_documents', 'public_statements'].forEach(function(type) {
                            if (areaData[type]) {
                                areaData[type].forEach(function(entry) {
                                    var text = entry.text || '';
                                    // Extract month and year from pattern like "(Month YYYY)" or "(YYYY)"
                                    var dateMatch = text.match(/\(([A-Z][a-z]+)?\s*(\d{4})\)/);
                                    if (dateMatch) {
                                        var monthStr = dateMatch[1] || '';
                                        var year = parseInt(dateMatch[2]);
                                        
                                        if (year >= 2016 && year <= 2025) {
                                            // Determine quarter (default to Q4 if no month)
                                            var quarter = 4;
                                            if (monthStr && monthToQuarter[monthStr]) {
                                                quarter = monthToQuarter[monthStr];
                                            }
                                            quarterlyData[year][quarter][shortName]++;
                                        }
                                    }
                                });
                            }
                        });
                    }
                });
            });
            
            // Calculate max for scaling (max of any single quarter)
            var maxQuarterTotal = 0;
            years.forEach(function(y) {
                quarters.forEach(function(q) {
                    var total = 0;
                    dims.forEach(function(d) { total += quarterlyData[y][q][d]; });
                    if (total > maxQuarterTotal) maxQuarterTotal = total;
                });
            });
            
            var chartHeight = 360;
            var scale = maxQuarterTotal > 0 ? chartHeight / maxQuarterTotal : 1;
            
            // Create grid lines
            var gridContainer = document.createElement('div');
            gridContainer.className = 'policy-growth-grid';
            var gridSteps = [0, 20, 40, 60, 80, 100];
            if (maxQuarterTotal > 100) gridSteps = [0, 25, 50, 75, 100, 125];
            if (maxQuarterTotal > 125) gridSteps = [0, 30, 60, 90, 120, 150];
            gridSteps.forEach(function(val) {
                if (val <= maxQuarterTotal * 1.1) {
                    var line = document.createElement('div');
                    line.className = 'policy-growth-grid-line';
                    line.style.bottom = ((val / maxQuarterTotal) * 100) + '%';
                    gridContainer.appendChild(line);
                }
            });
            container.appendChild(gridContainer);
            
            // Create Y-axis
            var yAxis = document.createElement('div');
            yAxis.className = 'policy-growth-y-axis';
            var yAxisSteps = gridSteps.slice().reverse();
            yAxisSteps.forEach(function(val) {
                if (val <= maxQuarterTotal * 1.1) {
                    var label = document.createElement('span');
                    label.textContent = val;
                    yAxis.appendChild(label);
                }
            });
            container.appendChild(yAxis);
            
            // Create tooltip element
            var tooltip = document.getElementById('policy-growth-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'policy-growth-tooltip';
                tooltip.className = 'policy-growth-hover-panel';
                document.body.appendChild(tooltip);
            }
            
            // Create bars container
            var barsContainer = document.createElement('div');
            barsContainer.className = 'policy-growth-bars';
            
            years.forEach(function(year) {
                var yearGroup = document.createElement('div');
                yearGroup.className = 'policy-growth-year-group';
                
                quarters.forEach(function(quarter) {
                    var counts = quarterlyData[year][quarter];
                    var total = 0;
                    dims.forEach(function(d) { total += counts[d]; });
                    
                    var group = document.createElement('div');
                    group.className = 'policy-growth-bar-group';
                    
                    // Store data for tooltip
                    group.dataset.year = year;
                    group.dataset.quarter = quarter;
                    group.dataset.total = total;
                    group.dataset.counts = JSON.stringify(counts);
                    
                    // Create stacked bar
                    var stack = document.createElement('div');
                    stack.className = 'policy-growth-bar-stack';
                    
                    dims.forEach(function(dim) {
                        if (counts[dim] > 0) {
                            var segment = document.createElement('div');
                            segment.className = 'policy-growth-bar-segment';
                            segment.style.height = (counts[dim] * scale) + 'px';
                            segment.style.background = colors[dim];
                            stack.appendChild(segment);
                        }
                    });
                    
                    // Mouse events for tooltip
                    group.addEventListener('mouseenter', function(e) {
                        var year = this.dataset.year;
                        var quarter = this.dataset.quarter;
                        var total = parseInt(this.dataset.total);
                        var counts = JSON.parse(this.dataset.counts);
                        
                        var quarterLabel = 'Q' + quarter + ' ' + year;
                        var html = '<div class="policy-growth-hover-title">' +
                            '<span>' + quarterLabel + '</span>' +
                            '<span class="policy-growth-hover-total">' + total + ' policies</span>' +
                            '</div><div class="policy-growth-hover-rows">';
                        
                        dims.forEach(function(dim) {
                            var count = counts[dim];
                            var pct = total > 0 ? (count / total) * 100 : 0;
                            html += '<div class="policy-growth-hover-row">' +
                                '<div class="policy-growth-hover-row-label">' + dimLabels[dim] + '</div>' +
                                '<div class="policy-growth-hover-row-bar">' +
                                    '<div class="policy-growth-hover-row-fill" style="width:' + pct + '%;background:' + colors[dim] + '"></div>' +
                                '</div>' +
                                '<div class="policy-growth-hover-row-pct">' + pct.toFixed(0) + '%</div>' +
                                '<div class="policy-growth-hover-row-count">' + count + '</div>' +
                            '</div>';
                        });
                        html += '</div>';
                        
                        tooltip.innerHTML = html;
                        tooltip.classList.add('visible');
                    });
                    
                    group.addEventListener('mousemove', function(e) {
                        var tooltipRect = tooltip.getBoundingClientRect();
                        var chartRect = container.getBoundingClientRect();
                        
                        var left = e.clientX - tooltipRect.width / 2;
                        var top = chartRect.top + 15;
                        
                        if (left < chartRect.left + 10) {
                            left = chartRect.left + 10;
                        }
                        if (left + tooltipRect.width > chartRect.right - 10) {
                            left = chartRect.right - tooltipRect.width - 10;
                        }
                        
                        tooltip.style.left = left + 'px';
                        tooltip.style.top = top + 'px';
                    });
                    
                    group.addEventListener('mouseleave', function() {
                        tooltip.classList.remove('visible');
                    });
                    
                    group.appendChild(stack);
                    yearGroup.appendChild(group);
                });
                
                barsContainer.appendChild(yearGroup);
            });
            
            container.appendChild(barsContainer);
            
            // Create X-axis ticks (4 per year)
            var xTicks = document.createElement('div');
            xTicks.className = 'policy-growth-x-ticks';
            years.forEach(function(year) {
                var tickGroup = document.createElement('div');
                tickGroup.className = 'policy-growth-x-tick-group';
                quarters.forEach(function(q) {
                    var tick = document.createElement('div');
                    tick.className = 'policy-growth-x-tick';
                    tickGroup.appendChild(tick);
                });
                xTicks.appendChild(tickGroup);
            });
            container.appendChild(xTicks);
            
            // Create X-axis labels (years only)
            var xAxis = document.createElement('div');
            xAxis.className = 'policy-growth-x-axis';
            years.forEach(function(year) {
                var label = document.createElement('div');
                label.className = 'policy-growth-x-label';
                label.textContent = year;
                xAxis.appendChild(label);
            });
            container.appendChild(xAxis);
        }
        
        // Download Policy Growth chart as PNG
        function downloadPolicyGrowthPNG() {
            var container = document.getElementById('policy-growth-chart');
            if (!container) return;
            
            // Use html2canvas if available, otherwise alert
            if (typeof html2canvas !== 'undefined') {
                html2canvas(container.parentElement, { 
                    backgroundColor: '#ffffff',
                    scale: 2
                }).then(function(canvas) {
                    var link = document.createElement('a');
                    link.download = 'policy_growth_timeline.png';
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                });
            } else {
                alert('PNG export requires html2canvas library. Please use browser screenshot instead.');
            }
        }
        
        // ===== CONVERGENCE TIMELINE =====
        // Define country groupings for comparison
        var convergenceGroupings = {
            "NATO Members": {
                members: ["USA", "UK", "France", "Germany", "Italy", "Canada", "Spain", "Netherlands", "Belgium", "Poland", "Norway", "Denmark", "Turkey", "Greece", "Hungary", "Czechia", "Estonia", "Latvia", "Lithuania", "Croatia", "Bulgaria"],
                color: "#0d7377",
                description: "NATO alliance members"
            },
            "AUKUS": {
                members: ["USA", "UK", "Australia"],
                color: "#e07020",
                description: "AUKUS security partnership"
            },
            "Five Eyes": {
                members: ["USA", "UK", "Canada", "Australia", "New Zealand"],
                color: "#1a2744",
                description: "Five Eyes intelligence alliance"
            }
        };
        
        var activeConvergenceGroups = [];
        var convergenceData = {};
        
        // Helper to get area emergence year for a country
        function getAreaEmergenceYear(country, areaShortName) {
            var areaNameMap = {
                'LAWS': 'LAWS Employment/Deployment',
                'Adoption': 'Adoption & Intent of Use',
                'Procurement': 'Acquisition & Procurement',
                'Safety': 'Technical Safety & Security Requirements',
                'Ethics': 'Ethical Guidelines & Restrictions',
                'Interoperability': "Int'l Cooperation & Interoperability"
            };
            
            var data = policyData[country];
            if (!data) return null;
            
            var fullName = areaNameMap[areaShortName];
            var area = data[fullName];
            if (!area) return null;
            
            var entries = (area.legal_directives || [])
                .concat(area.policy_documents || [])
                .concat(area.public_statements || []);
            
            var minYear = 2030;
            entries.forEach(function(entry) {
                var text = entry.text || entry;
                var match = text.match(/\(([A-Za-z]{3,4}\s+)?(\d{4})\)/);
                if (match) {
                    var yr = parseInt(match[2]);
                    if (yr < minYear && yr >= 2010) minYear = yr;
                }
            });
            
            return minYear < 2030 ? minYear : null;
        }
        
        // Calculate blended similarity (20% presence + 80% substance) with temporal evolution
        function calculateCountrySimilarity(country1, country2, year) {
            // Use pre-calculated yearly scores
            var yearlyScores = rawData.yearlyScores || {};
            var scores1 = yearlyScores[country1];
            var scores2 = yearlyScores[country2];
            
            if (!scores1 || !scores2) return null;
            
            var yearStr = year.toString();
            var s1 = scores1[yearStr];
            var s2 = scores2[yearStr];
            
            if (!s1 || !s2) return null;
            
            var dims = ['LAWS', 'Adoption', 'Procurement', 'Safety', 'Ethics', 'Interoperability'];
            
            // Count how many areas each country has data for
            var country1Areas = 0;
            var country2Areas = 0;
            
            dims.forEach(function(dim) {
                if (s1[dim] !== null && s1[dim] !== undefined) country1Areas++;
                if (s2[dim] !== null && s2[dim] !== undefined) country2Areas++;
            });
            
            // If either country has NO policy data for this year, return null
            if (country1Areas === 0 || country2Areas === 0) {
                return null;
            }
            
            var presenceScore = 0;
            var substanceScore = 0;
            var activeAreas = 0;
            var relevantAreas = 0;
            
            dims.forEach(function(dim) {
                var v1 = s1[dim];
                var v2 = s2[dim];
                
                var has1 = v1 !== null && v1 !== undefined;
                var has2 = v2 !== null && v2 !== undefined;
                
                // Only consider areas where at least one country has data
                if (has1 || has2) {
                    relevantAreas++;
                    if (has1 === has2) {
                        presenceScore += 1;
                    }
                }
                
                // Substance similarity: only for areas where both countries have data
                if (has1 && has2) {
                    var dimSim = 1 - Math.abs(v1 - v2) / 4;
                    substanceScore += dimSim;
                    activeAreas++;
                }
            });
            
            // Normalize scores
            presenceScore = relevantAreas > 0 ? presenceScore / relevantAreas : 0;
            substanceScore = activeAreas > 0 ? substanceScore / activeAreas : 0;
            
            // Calculate base similarity
            var baseSimilarity;
            if (activeAreas === 0) {
                baseSimilarity = presenceScore * 0.3;
            } else {
                baseSimilarity = 0.2 * presenceScore + 0.8 * substanceScore;
            }
            
            // Apply voting divergence penalty (or bonus for same stance)
            var votingPenalty = calcVotingDivergencePenalty(country1, country2, year);
            return Math.min(1, Math.max(0, baseSimilarity - votingPenalty));
        }
        
        // Helper function to count entries up to a given year
        function getEntryCountUpToYear(country, year) {
            var data = policyData[country];
            if (!data) return 0;
            
            var count = 0;
            var POLICY_AREAS = [
                "LAWS Employment/Deployment",
                "Adoption & Intent of Use",
                "Acquisition & Procurement",
                "Ethical Guidelines & Restrictions",
                "Technical Safety & Security Requirements",
                "Int'l Cooperation & Interoperability"
            ];
            
            POLICY_AREAS.forEach(function(area) {
                var areaData = data[area];
                if (!areaData) return;
                
                ['legal_directives', 'policy_documents', 'public_statements'].forEach(function(type) {
                    if (areaData[type]) {
                        areaData[type].forEach(function(entry) {
                            var text = entry.text || '';
                            var yearMatch = text.match(/\(([A-Z][a-z]+ )?(\d{4})\)/);
                            var entryYear = yearMatch ? parseInt(yearMatch[2]) : 2020;
                            if (entryYear <= year) {
                                count++;
                            }
                        });
                    }
                });
            });
            
            return count;
        }
        
        // Calculate group similarity for a year using blended approach
        function calculateGroupSimilarity(groupName, year) {
            var group = convergenceGroupings[groupName];
            if (!group) return null;
            
            var membersWithData = group.members.filter(function(m) { return policyData[m]; });
            if (membersWithData.length < 2) return null;
            
            var similarities = [];
            for (var i = 0; i < membersWithData.length; i++) {
                for (var j = i + 1; j < membersWithData.length; j++) {
                    var sim = calculateCountrySimilarity(membersWithData[i], membersWithData[j], year);
                    if (sim !== null && !isNaN(sim)) {
                        similarities.push(sim);
                    }
                }
            }
            
            if (similarities.length === 0) return null;
            
            var avg = similarities.reduce(function(a, b) { return a + b; }, 0) / similarities.length;
            return avg;
        }
        
        function renderConvergenceTimeline(alliance) {
            var container = document.getElementById("convergence-timeline-container");
            var svg = document.getElementById("convergence-chart-svg");
            var legendContainer = document.getElementById("convergence-legend");
            var groupingsContainer = document.getElementById("convergence-groupings");
            var similarityBars = document.getElementById("convergence-similarity-bars");
            var eventsList = document.getElementById("convergence-events-list");
            
            if (!container || !svg) {
                if (container) container.style.display = "none";
                return;
            }
            
            // Show container
            container.style.display = "block";
            
            // Initialize with the selected alliance if it has a matching grouping
            if (alliance && activeConvergenceGroups.length === 0) {
                // Map alliance names to grouping names
                var allianceToGrouping = {
                    "NATO": "NATO Members",
                    "AUKUS": "AUKUS",
                    "FVEY": "Five Eyes"
                };
                var matchedGrouping = allianceToGrouping[alliance];
                if (matchedGrouping && convergenceGroupings[matchedGrouping]) {
                    activeConvergenceGroups = [matchedGrouping];
                } else {
                    activeConvergenceGroups = ["NATO Members"];
                }
            }
            
            // Render grouping buttons
            groupingsContainer.innerHTML = '<div class="convergence-groupings-label">Select Country Groupings</div>';
            
            Object.keys(convergenceGroupings).forEach(function(groupName) {
                var btn = document.createElement("button");
                btn.className = "convergence-group-btn";
                if (activeConvergenceGroups.indexOf(groupName) !== -1) {
                    btn.classList.add("active");
                }
                btn.textContent = groupName;
                btn.addEventListener("click", function() {
                    var idx = activeConvergenceGroups.indexOf(groupName);
                    if (idx === -1) {
                        activeConvergenceGroups.push(groupName);
                    } else {
                        activeConvergenceGroups.splice(idx, 1);
                    }
                    renderConvergenceChart();
                });
                groupingsContainer.appendChild(btn);
            });
            
            renderConvergenceChart();
            
            function renderConvergenceChart() {
                // Update button states
                var btns = groupingsContainer.querySelectorAll(".convergence-group-btn");
                btns.forEach(function(btn) {
                    if (activeConvergenceGroups.indexOf(btn.textContent) !== -1) {
                        btn.classList.add("active");
                    } else {
                        btn.classList.remove("active");
                    }
                });
                
                // Calculate data for all active groups
                var years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
                convergenceData = {};
                
                activeConvergenceGroups.forEach(function(groupName) {
                    convergenceData[groupName] = [];
                    years.forEach(function(year) {
                        var sim = calculateGroupSimilarity(groupName, year);
                        convergenceData[groupName].push({
                            year: year,
                            similarity: sim !== null ? sim * 100 : null
                        });
                    });
                });
                
                // Render SVG chart
                var chartArea = document.getElementById("convergence-chart-area");
                var width = chartArea.offsetWidth || 600;
                var height = 300;
                var margin = { top: 30, right: 30, bottom: 45, left: 60 };
                var plotWidth = width - margin.left - margin.right;
                var plotHeight = height - margin.top - margin.bottom;
                
                svg.innerHTML = '';
                svg.setAttribute("width", width);
                svg.setAttribute("height", height);
                svg.setAttribute("viewBox", "0 0 " + width + " " + height);
                
                // Y-axis (0-100%)
                var yTicks = [0, 25, 50, 75, 100];
                yTicks.forEach(function(val) {
                    var y = margin.top + plotHeight - (val / 100) * plotHeight;
                    
                    // Grid line
                    var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    line.setAttribute("x1", margin.left);
                    line.setAttribute("y1", y);
                    line.setAttribute("x2", width - margin.right);
                    line.setAttribute("y2", y);
                    line.setAttribute("stroke", "#e8ebef");
                    line.setAttribute("stroke-width", "1");
                    if (val === 75) line.setAttribute("stroke-dasharray", "4,4");
                    if (val === 25) line.setAttribute("stroke-dasharray", "4,4");
                    svg.appendChild(line);
                    
                    // Label
                    var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    label.setAttribute("x", margin.left - 10);
                    label.setAttribute("y", y + 4);
                    label.setAttribute("text-anchor", "end");
                    label.setAttribute("font-size", "11");
                    label.setAttribute("fill", "#7a8a9a");
                    label.textContent = val + "%";
                    svg.appendChild(label);
                });
                
                // Y-axis label
                var yAxisLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                yAxisLabel.setAttribute("x", 15);
                yAxisLabel.setAttribute("y", margin.top + plotHeight / 2);
                yAxisLabel.setAttribute("text-anchor", "middle");
                yAxisLabel.setAttribute("font-size", "11");
                yAxisLabel.setAttribute("fill", "#1a2744");
                yAxisLabel.setAttribute("font-weight", "600");
                yAxisLabel.setAttribute("transform", "rotate(-90, 15, " + (margin.top + plotHeight / 2) + ")");
                yAxisLabel.textContent = "Policy Similarity Index";
                svg.appendChild(yAxisLabel);
                
                // X-axis (years)
                years.forEach(function(year, idx) {
                    var x = margin.left + (idx / (years.length - 1)) * plotWidth;
                    
                    // Tick line
                    var tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    tick.setAttribute("x1", x);
                    tick.setAttribute("y1", margin.top + plotHeight);
                    tick.setAttribute("x2", x);
                    tick.setAttribute("y2", margin.top + plotHeight + 5);
                    tick.setAttribute("stroke", "#7a8a9a");
                    tick.setAttribute("stroke-width", "1");
                    svg.appendChild(tick);
                    
                    // Label
                    var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    label.setAttribute("x", x);
                    label.setAttribute("y", margin.top + plotHeight + 20);
                    label.setAttribute("text-anchor", "middle");
                    label.setAttribute("font-size", "11");
                    label.setAttribute("fill", "#7a8a9a");
                    label.setAttribute("font-weight", "600");
                    label.textContent = year;
                    svg.appendChild(label);
                });
                
                // X-axis label
                var xAxisLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                xAxisLabel.setAttribute("x", margin.left + plotWidth / 2);
                xAxisLabel.setAttribute("y", height - 8);
                xAxisLabel.setAttribute("text-anchor", "middle");
                xAxisLabel.setAttribute("font-size", "11");
                xAxisLabel.setAttribute("fill", "#1a2744");
                xAxisLabel.setAttribute("font-weight", "600");
                xAxisLabel.textContent = "Year";
                svg.appendChild(xAxisLabel);
                
                // Draw lines and dots for each group
                activeConvergenceGroups.forEach(function(groupName) {
                    var groupData = convergenceData[groupName];
                    var color = convergenceGroupings[groupName].color;
                    
                    // Filter valid data points
                    var validPoints = groupData.filter(function(d) { return d.similarity !== null; });
                    if (validPoints.length < 2) return;
                    
                    // Create path
                    var pathD = "";
                    validPoints.forEach(function(d, idx) {
                        var x = margin.left + ((d.year - 2019) / (2025 - 2019)) * plotWidth;
                        var y = margin.top + plotHeight - (d.similarity / 100) * plotHeight;
                        
                        if (idx === 0) {
                            pathD += "M " + x + " " + y;
                        } else {
                            pathD += " L " + x + " " + y;
                        }
                    });
                    
                    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path.setAttribute("d", pathD);
                    path.setAttribute("class", "convergence-line");
                    path.setAttribute("stroke", color);
                    svg.appendChild(path);
                    
                    // Add dots
                    validPoints.forEach(function(d) {
                        var x = margin.left + ((d.year - 2019) / (2025 - 2019)) * plotWidth;
                        var y = margin.top + plotHeight - (d.similarity / 100) * plotHeight;
                        
                        var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                        circle.setAttribute("cx", x);
                        circle.setAttribute("cy", y);
                        circle.setAttribute("r", 6);
                        circle.setAttribute("fill", color);
                        circle.setAttribute("class", "convergence-dot");
                        
                        circle.addEventListener("mouseenter", function(e) {
                            var tooltip = document.getElementById("convergence-tooltip");
                            tooltip.innerHTML = '<strong>' + groupName + '</strong><br>' +
                                'Year: ' + d.year + '<br>' +
                                'Similarity: ' + d.similarity.toFixed(1) + '%';
                            tooltip.classList.add("visible");
                        });
                        
                        circle.addEventListener("mousemove", function(e) {
                            var tooltip = document.getElementById("convergence-tooltip");
                            tooltip.style.left = (e.clientX + 15) + "px";
                            tooltip.style.top = (e.clientY - 10) + "px";
                        });
                        
                        circle.addEventListener("mouseleave", function() {
                            document.getElementById("convergence-tooltip").classList.remove("visible");
                        });
                        
                        svg.appendChild(circle);
                    });
                });
                
                // Render legend with trend indicators
                legendContainer.innerHTML = '';
                activeConvergenceGroups.forEach(function(groupName) {
                    var groupData = convergenceData[groupName];
                    var color = convergenceGroupings[groupName].color;
                    
                    var validPoints = groupData.filter(function(d) { return d.similarity !== null; });
                    var firstVal = validPoints.length > 0 ? validPoints[0].similarity : 0;
                    var lastVal = validPoints.length > 0 ? validPoints[validPoints.length - 1].similarity : 0;
                    var change = lastVal - firstVal;
                    var changeStr = (change >= 0 ? "↑ +" : "↓ ") + change.toFixed(0) + "%";
                    var changeClass = change >= 0 ? "positive" : "negative";
                    
                    var item = document.createElement("div");
                    item.className = "convergence-legend-item";
                    item.innerHTML = '<div class="convergence-legend-left">' +
                        '<div class="convergence-legend-marker" style="background:' + color + '"></div>' +
                        '<span class="convergence-legend-name">' + groupName + '</span>' +
                        '</div>' +
                        '<span class="convergence-legend-change ' + changeClass + '">' + changeStr + '</span>';
                    legendContainer.appendChild(item);
                });
                
                // Render similarity bars (current year)
                similarityBars.innerHTML = '';
                activeConvergenceGroups.forEach(function(groupName) {
                    var groupData = convergenceData[groupName];
                    var color = convergenceGroupings[groupName].color;
                    
                    var lastPoint = groupData.filter(function(d) { return d.similarity !== null; }).slice(-1)[0];
                    var currentSim = lastPoint ? lastPoint.similarity : 0;
                    
                    var row = document.createElement("div");
                    row.className = "convergence-similarity-row";
                    row.innerHTML = '<div class="convergence-similarity-name" style="color:' + color + '">' + groupName + '</div>' +
                        '<div class="convergence-similarity-bar-bg">' +
                        '<div class="convergence-similarity-bar-fill" style="width:' + currentSim + '%; background:' + color + '"></div>' +
                        '</div>' +
                        '<div class="convergence-similarity-value">' + currentSim.toFixed(0) + '%</div>';
                    similarityBars.appendChild(row);
                });
                
                // Render key events
                var keyEvents = [
                    { year: 2019, text: "Initial LAWS discussions at CCW" },
                    { year: 2020, text: "COVID-19 policy slowdown" },
                    { year: 2021, text: "NATO AI Strategy adopted" },
                    { year: 2022, text: "Ukraine conflict accelerates policy" },
                    { year: 2023, text: "EU AI Act negotiations" },
                    { year: 2024, text: "Multiple national AI strategies released" }
                ];
                
                eventsList.innerHTML = '';
                keyEvents.forEach(function(event) {
                    var item = document.createElement("div");
                    item.className = "convergence-event-item";
                    item.innerHTML = '<span class="convergence-event-year">' + event.year + '</span>' +
                        '<span class="convergence-event-text">' + event.text + '</span>';
                    eventsList.appendChild(item);
                });
            }
        }
        
        function downloadMomentumPNG() {
            alert("PNG download would capture the momentum chart. In production, use html2canvas library.");
        }
        
        // ===== POLICY AREA FILTER =====
        function initPolicyAreaFilter() {
            var dropdown = document.getElementById("policy-area-filter");
            if (!dropdown) return;
            
            dropdown.addEventListener("change", function() {
                var selectedArea = this.value;
                
                if (!selectedArea) {
                    // If deselected and no other content showing, reset to placeholder
                    if (currentContentType === "policyArea") {
                        resetToPlaceholder();
                    }
                    return;
                }
                
                // Clear other selections
                document.getElementById("overview-dropdown").value = "";
                document.getElementById("keyword-search").value = "";
                selectedCountry = null;
                currentContentType = "policyArea";
                
                // Calculate countries with entries in this area
                var countriesWithArea = [];
                Object.keys(policyData).forEach(function(country) {
                    var countryData = policyData[country];
                    var areaData = countryData[selectedArea];
                    if (areaData) {
                        var total = (areaData.legal_directives || []).length +
                                   (areaData.policy_documents || []).length +
                                   (areaData.public_statements || []).length;
                        if (total > 0) {
                            countriesWithArea.push({
                                country: country,
                                displayName: displayNames[country] || country,
                                count: total
                            });
                        }
                    }
                });
                
                // Sort by count descending
                countriesWithArea.sort(function(a, b) { return b.count - a.count; });
                
                // Set header
                var totalEntries = countriesWithArea.reduce(function(a, b) { return a + b.count; }, 0);
                setContentHeader(selectedArea, countriesWithArea.length + " countries • " + totalEntries + " entries", false, true);
                
                // Render country cards in main content area
                var content = document.getElementById("overview-content");
                var grid = document.createElement("div");
                grid.className = "content-country-grid";
                
                countriesWithArea.forEach(function(item) {
                    var card = document.createElement("div");
                    card.className = "content-country-card";
                    card.innerHTML = '<div class="content-country-name">' + escapeHtml(item.displayName) + '</div>' +
                        '<div class="content-country-meta">' +
                        '<span class="content-count-badge">' + item.count + '</span>' +
                        '<span class="content-arrow">→</span>' +
                        '</div>';
                    
                    card.addEventListener("click", function() {
                        openPolicyAreaSidePanel(item.country, selectedArea, item.count);
                    });
                    
                    grid.appendChild(card);
                });
                
                content.innerHTML = "";
                content.appendChild(grid);
                
                // Clear map selection
                if (typeof d3 !== 'undefined') {
                    d3.selectAll(".country-path").classed("selected", false);
                }
            });
        }
        
        // ===== SIDE PANEL =====
        function openPolicyAreaSidePanel(country, policyArea, entryCount) {
            var overlay = document.getElementById("side-panel-overlay");
            var panel = document.getElementById("side-panel");
            var content = document.getElementById("side-panel-content");
            var title = document.getElementById("side-panel-title");
            var subtitle = document.getElementById("side-panel-subtitle");
            var viewCountryLink = document.getElementById("side-panel-view-country");
            
            // Set header info
            title.textContent = displayNames[country] || country;
            subtitle.textContent = getShortAreaName(policyArea) + " • " + entryCount + " entries";
            
            // Set up "View full country profile" link
            viewCountryLink.onclick = function() {
                closeSidePanel();
                document.getElementById("policy-area-filter").value = "";
                selectOverviewCountry(country);
            };
            
            // Populate entries
            content.innerHTML = "";
            var countryData = policyData[country];
            var areaData = countryData[policyArea];
            
            if (!areaData) {
                content.innerHTML = '<div class="side-panel-empty">No entries found.</div>';
                return;
            }
            
            var sourceTypes = [
                { key: "legal_directives", label: "Legal" },
                { key: "policy_documents", label: "Policy" },
                { key: "public_statements", label: "Statement" }
            ];
            
            sourceTypes.forEach(function(source) {
                var entries = areaData[source.key] || [];
                entries.forEach(function(entry) {
                    var text = entry.text || "";
                    var entryTitle = parseTitleWithoutDate(text);
                    var url = extractUrl(text);
                    var date = extractDate(text);
                    
                    var entryEl = document.createElement("div");
                    entryEl.className = "side-panel-entry";
                    
                    var header = document.createElement("div");
                    header.className = "side-panel-entry-header";
                    header.innerHTML = 
                        '<div class="side-panel-entry-expand"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18l6-6-6-6"/></svg></div>' +
                        '<div class="side-panel-entry-info">' +
                            '<div class="side-panel-entry-title">' + escapeHtml(entryTitle) + '</div>' +
                            '<div class="side-panel-entry-meta">' +
                                '<span class="side-panel-entry-type ' + source.label.toLowerCase() + '">' + source.label + '</span>' +
                                (date ? '<span>' + date + '</span>' : '') +
                            '</div>' +
                        '</div>';
                    
                    header.addEventListener("click", function() {
                        entryEl.classList.toggle("expanded");
                    });
                    
                    entryEl.appendChild(header);
                    
                    // Description
                    var desc = document.createElement("div");
                    desc.className = "side-panel-entry-description";
                    desc.textContent = text;
                    if (url) {
                        desc.innerHTML = escapeHtml(text) + '<div class="side-panel-entry-link"><a href="' + url + '" target="_blank">View source →</a></div>';
                    }
                    entryEl.appendChild(desc);
                    
                    content.appendChild(entryEl);
                });
            });
            
            // Show panel
            overlay.classList.add("active");
            panel.classList.add("active");
            document.body.style.overflow = "hidden";
        }
        
        function closeSidePanel() {
            var overlay = document.getElementById("side-panel-overlay");
            var panel = document.getElementById("side-panel");
            overlay.classList.remove("active");
            panel.classList.remove("active");
            document.body.style.overflow = "";
        }
        
        function initSidePanel() {
            var overlay = document.getElementById("side-panel-overlay");
            var closeBtn = document.getElementById("side-panel-close");
            
            if (overlay) {
                overlay.addEventListener("click", closeSidePanel);
            }
            
            if (closeBtn) {
                closeBtn.addEventListener("click", closeSidePanel);
            }
            
            // Close on Escape key
            document.addEventListener("keydown", function(e) {
                if (e.key === "Escape") {
                    closeSidePanel();
                }
            });
        }
        
        // ===== KEYWORD SEARCH =====
        function initKeywordSearch() {
            var searchInput = document.getElementById("keyword-search");
            var searchBtn = document.getElementById("keyword-search-btn");
            
            if (!searchInput || !searchBtn) return;
            
            function performSearch() {
                var keyword = searchInput.value.trim().toLowerCase();
                if (keyword.length < 2) {
                    alert("Please enter at least 2 characters to search.");
                    return;
                }
                
                // Clear other selections
                document.getElementById("overview-dropdown").value = "";
                document.getElementById("policy-area-filter").value = "";
                selectedCountry = null;
                currentContentType = "keyword";
                
                // Search through all entries
                var results = {};
                var totalCount = 0;
                
                var POLICY_AREAS = [
                    "LAWS Employment/Deployment",
                    "Adoption & Intent of Use",
                    "Acquisition & Procurement",
                    "Ethical Guidelines & Restrictions",
                    "Technical Safety & Security Requirements",
                    "Int'l Cooperation & Interoperability"
                ];
                
                Object.keys(policyData).forEach(function(country) {
                    var countryData = policyData[country];
                    var countryMatches = [];
                    
                    POLICY_AREAS.forEach(function(area) {
                        var areaData = countryData[area];
                        if (!areaData) return;
                        
                        var sourceTypes = [
                            { key: "legal_directives", label: "Legal" },
                            { key: "policy_documents", label: "Policy" },
                            { key: "public_statements", label: "Statement" }
                        ];
                        
                        sourceTypes.forEach(function(source) {
                            var entries = areaData[source.key] || [];
                            entries.forEach(function(entry) {
                                var text = entry.text || "";
                                if (text.toLowerCase().indexOf(keyword) !== -1) {
                                    countryMatches.push({
                                        area: area,
                                        type: source.label,
                                        text: text,
                                        url: extractUrl(text)
                                    });
                                    totalCount++;
                                }
                            });
                        });
                    });
                    
                    if (countryMatches.length > 0) {
                        results[country] = countryMatches;
                    }
                });
                
                // Render results
                renderKeywordResults(keyword, results, totalCount);
                
                // Clear map selection
                if (typeof d3 !== 'undefined') {
                    d3.selectAll(".country-path").classed("selected", false);
                }
            }
            
            searchBtn.addEventListener("click", performSearch);
            searchInput.addEventListener("keypress", function(e) {
                if (e.key === "Enter") performSearch();
            });
        }
        
        function renderKeywordResults(keyword, results, totalCount) {
            var content = document.getElementById("overview-content");
            var countryCount = Object.keys(results).length;
            
            // Set header
            setContentHeader(
                'Results for "' + keyword + '"',
                totalCount + " entries across " + countryCount + " countries",
                false,
                true
            );
            
            content.innerHTML = "";
            
            if (countryCount === 0) {
                content.innerHTML = '<div class="placeholder"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><p>No entries found matching "' + escapeHtml(keyword) + '"</p></div>';
                return;
            }
            
            var resultsContainer = document.createElement("div");
            resultsContainer.className = "content-keyword-results";
            
            // Sort countries by match count
            var sortedCountries = Object.keys(results).sort(function(a, b) {
                return results[b].length - results[a].length;
            });
            
            sortedCountries.forEach(function(country) {
                var matches = results[country];
                var countryName = displayNames[country] || country;
                
                var group = document.createElement("div");
                group.className = "keyword-country-group";
                
                // Country header
                var header = document.createElement("div");
                header.className = "keyword-country-header";
                header.innerHTML = '<span class="keyword-country-name">' + escapeHtml(countryName) + '</span>' +
                    '<span class="keyword-country-count">' + matches.length + ' match' + (matches.length > 1 ? 'es' : '') + '</span>';
                header.addEventListener("click", function() {
                    document.getElementById("keyword-search").value = "";
                    selectOverviewCountry(country);
                });
                group.appendChild(header);
                
                // Entry list
                var entryList = document.createElement("div");
                entryList.className = "keyword-entry-list";
                
                matches.forEach(function(match, idx) {
                    var entry = document.createElement("div");
                    entry.className = "keyword-entry";
                    
                    // Parse title from text
                    var title = parseTitleWithoutDate(match.text);
                    var highlightedTitle = highlightKeyword(title, keyword);
                    var highlightedDesc = highlightKeyword(match.text, keyword);
                    
                    // Entry header (clickable to expand)
                    var entryHeader = document.createElement("div");
                    entryHeader.className = "keyword-entry-header";
                    entryHeader.innerHTML = 
                        '<div class="keyword-entry-expand"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18l6-6-6-6"/></svg></div>' +
                        '<div class="keyword-entry-info">' +
                            '<div class="keyword-entry-title">' + highlightedTitle + '</div>' +
                            '<div class="keyword-entry-meta">' +
                                '<span class="keyword-entry-type ' + match.type.toLowerCase() + '">' + match.type + '</span>' +
                                '<span>' + getShortAreaName(match.area) + '</span>' +
                            '</div>' +
                        '</div>';
                    
                    entryHeader.addEventListener("click", function(e) {
                        entry.classList.toggle("expanded");
                    });
                    
                    entry.appendChild(entryHeader);
                    
                    // Description (hidden by default)
                    var desc = document.createElement("div");
                    desc.className = "keyword-entry-description";
                    desc.innerHTML = highlightedDesc;
                    if (match.url) {
                        desc.innerHTML += '<div class="keyword-entry-link"><a href="' + match.url + '" target="_blank">View source →</a></div>';
                    }
                    entry.appendChild(desc);
                    
                    entryList.appendChild(entry);
                });
                
                group.appendChild(entryList);
                resultsContainer.appendChild(group);
            });
            
            content.appendChild(resultsContainer);
        }
        
        function highlightKeyword(text, keyword) {
            var regex = new RegExp("(" + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ")", "gi");
            return escapeHtml(text).replace(regex, "<mark>$1</mark>");
        }
        
        function getShortAreaName(area) {
            var shortNames = {
                "LAWS Employment/Deployment": "LAWS",
                "Adoption & Intent of Use": "Adoption",
                "Ethical Guidelines & Restrictions": "Ethics",
                "Technical Safety & Security Requirements": "Tech Safety",
                "Acquisition & Procurement": "Acquisition",
                "Int'l Cooperation & Interoperability": "Int'l Coop"
            };
            return shortNames[area] || area;
        }
        
        // ===== DOWNLOAD FUNCTIONS =====
        function downloadFullCSV() {
            var csvRows = [];
            var headers = ["Country", "Policy Area", "Source Type", "Title", "Date", "Description", "URL"];
            csvRows.push(headers.join(","));
            
            Object.keys(policyData).forEach(function(country) {
                var countryData = policyData[country];
                Object.keys(countryData).forEach(function(area) {
                    var areaData = countryData[area];
                    
                    var sourceTypes = [
                        { key: "legal_directives", label: "Legal Directive" },
                        { key: "policy_documents", label: "Policy Document" },
                        { key: "public_statements", label: "Public Statement" }
                    ];
                    
                    sourceTypes.forEach(function(st) {
                        if (areaData[st.key]) {
                            areaData[st.key].forEach(function(entry) {
                                var text = entry.text || "";
                                var url = entry.url || extractUrl(text) || "";
                                var title = parseTitleWithoutDate(text);
                                var date = extractDate(text) || "";
                                var description = text.split("\n").slice(1).join(" ").trim().substring(0, 500);
                                
                                var row = [
                                    '"' + (displayNames[country] || country).replace(/"/g, '""') + '"',
                                    '"' + area.replace(/"/g, '""') + '"',
                                    '"' + st.label + '"',
                                    '"' + title.replace(/"/g, '""') + '"',
                                    '"' + date + '"',
                                    '"' + description.replace(/"/g, '""') + '"',
                                    '"' + url + '"'
                                ];
                                csvRows.push(row.join(","));
                            });
                        }
                    });
                });
            });
            
            var csvContent = csvRows.join("\n");
            var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            var link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "global_defense_ai_policy_database.csv";
            link.click();
        }
        
        // Initialize analytics on page load
        setTimeout(function() {
            renderMomentumChart();
            renderPolicyGrowthChart();
            initPolicyAreaFilter();
            initKeywordSearch();
            initSidePanel();
            initClearButton();
            
            // Re-render on window resize
            window.addEventListener("resize", function() {
                renderMomentumChart();
                renderPolicyGrowthChart();
            });
        }, 100);

        // ===== STICKY HEADER SCROLL =====
        (function() {
            var header = document.getElementById('siteHeader');
            var accentBar = document.querySelector('.header-accent');
            if (!header) return;
            
            var compactThreshold = 120;
            var isCompact = false;
            var ticking = false;
            var transitionLock = false;
            
            function updateHeader() {
                var y = window.scrollY || window.pageYOffset;
                var docHeight = document.documentElement.scrollHeight - window.innerHeight;
                var scrollProgress = docHeight > 0 ? (y / docHeight) : 0;
                
                // Update progress bar to reflect scroll position
                if (accentBar) {
                    var scale = 0.03 + (scrollProgress * 0.97);
                    accentBar.style.transform = 'scaleX(' + scale + ')';
                }
                
                // Toggle compact header with transition lock to prevent glitching
                if (!transitionLock) {
                    if (!isCompact && y > compactThreshold) {
                        header.classList.add('compact');
                        isCompact = true;
                        transitionLock = true;
                        setTimeout(function() { transitionLock = false; }, 400);
                    } else if (isCompact && y <= 5) {
                        header.classList.remove('compact');
                        isCompact = false;
                        transitionLock = true;
                        setTimeout(function() { transitionLock = false; }, 400);
                    }
                }
                
                ticking = false;
            }
            
            window.addEventListener('scroll', function() {
                if (!ticking) {
                    requestAnimationFrame(updateHeader);
                    ticking = true;
                }
            }, { passive: true });
            
            // Initial call
            updateHeader();
        })();

        // ===== TIMELINE TICK MARKS =====
        (function() {
            var slider = document.getElementById('map-time-slider');
            if (!slider) return;
            var group = slider.parentElement;
            if (!group) return;
            // Make parent relative for tick positioning
            group.style.position = 'relative';
            var ticksEl = document.createElement('div');
            ticksEl.className = 'map-footer-ticks';
            // 10 years (2016-2025), ticks at each year boundary = positions 0,4,8,...,36 on 0-39 range
            for (var i = 0; i <= 9; i++) {
                var tick = document.createElement('div');
                tick.className = 'map-footer-tick';
                var pct = (i * 4) / 39 * 100;
                tick.style.left = pct + '%';
                ticksEl.appendChild(tick);
            }
            group.appendChild(ticksEl);
        })();
}
