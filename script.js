let globalFireData = null;

// === Shared Tooltip Element ===
const tooltip = d3.select("#tooltip");

// === SECTION 1: Stacked Bar Frame Chart (Title) ===
function drawSection1_TitleStackedBar(data) {
  const margin = { top: 20, right: 20, bottom: 130, left: 10 },
        width = 1000 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

  const svg = d3.select("#chart-title")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const years = [2019, 2020, 2021, 2022, 2023];
  const states = data.map(d => d.state);

  const yearWidths = {
      2023: 0.4,
      2022: 0.65,
      2021: 0.8,
      2020: 0.95,
      2019: 1.0
    };

  const stackedData = data.map(d => {
    const result = { state: d.state };
    d.variables.forEach(v => {
      result[v.year] = Math.log10(v.fires + 1); // log scale
    });
    return result;
  });

  const stack = d3.stack().keys(years);
  const series = stack(stackedData);

  const x = d3.scaleBand()
    .domain(states)
    .range([0, width])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(stackedData, d => years.reduce((sum, yr) => sum + (d[yr] || 0), 0))])
    .nice()
    .range([height, 0]);

  const color = d3.scaleOrdinal()
    .domain(years)
    .range(["#ffd54f", "#ffb74d", "#ff8a65", "#e57373", "#d32f2f"]);

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("fill", "#ccc")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

    svg.selectAll("g.layer")
      .data(series)
      .join("g")
      .attr("fill", d => color(d.key))
      .selectAll("rect")
      .data(d => d)
      .join("rect")
      .attr("x", function (d) {
        const year = this.parentNode.__data__.key;
        const scale = yearWidths[year] || 1;
        return x(d.data.state) + (x.bandwidth() * (1 - scale)) / 2;
      })
      .attr("width", function () {
        const year = this.parentNode.__data__.key;
        return x.bandwidth() * (yearWidths[year] || 1);
      })
      .attr("y", d => y(d[1]))
      .attr("height", d => y(d[0]) - y(d[1]))
    .on("mouseover", function (event, d) {
      const year = this.parentNode.__data__.key;
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html(`
        <strong>State:</strong> ${d.data.state}<br/>
        <strong>Year:</strong> ${year}<br/>
        <strong>Fires:</strong> ${data.find(s => s.state === d.data.state).variables.find(v => v.year == year).fires}
      `)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 40) + "px");
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 40) + "px");
    })
    .on("mouseout", () => {
      tooltip.transition().duration(300).style("opacity", 0);
    });
}

function drawSection2_LineChartsAnimated(data) {
  const width = 800;
  const height = 300;
  const margin = { top: 30, right: 30, bottom: 40, left: 60 };

  d3.csv("data/fire_agg_2000_2023.csv", d => ({
    year: +d.year,
    fires: +d.fires_cnt,
    area: +d.total_burned_area
  })).then(data => {
    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.year))
      .range([margin.left, width - margin.right]);

    const xAxis = g => g
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(10))
      .call(g => g.selectAll("text").attr("fill", "#ccc"))
      .call(g => g.selectAll("line").attr("stroke", "#444"));

    const line = (yAccessor, yScale) => d3.line()
      .x(d => x(d.year))
      .y(d => yScale(d[yAccessor]));

    const drawChart = (containerId, yKey, label, color) => {
      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d[yKey])])
        .nice()
        .range([height - margin.bottom, margin.top]);

      const svg = d3.select(containerId)
        .append("svg")
        .attr("width", width)
        .attr("height", height);

      svg.append("g").call(xAxis);

      svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(
          d3.axisLeft(y).ticks(5).tickFormat(yKey === "area"
            ? d => `${(d / 1_000_000).toFixed(1)}M`
            : d3.format(","))
        )
        .call(g => g.selectAll("text").attr("fill", "#ccc"))
        .call(g => g.selectAll("line").attr("stroke", "#444"));

      svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .attr("fill", "#ccc")
        .style("font-size", "12px")
        .text(label);

      const path = svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2.5)
        .attr("d", line(yKey, y));

      // Animate path
      const totalLength = path.node().getTotalLength();
      path
        .attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(2000)
        .ease(d3.easeCubic)
        .attr("stroke-dashoffset", 0);

      svg.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d[yKey]))
        .attr("r", 3)
        .attr("fill", color)
        .append("title")
        .text(d => `${d.year}: ${label} = ${Math.round(d[yKey]).toLocaleString()}`);
    };

    drawChart("#chart-fires-over-time", "fires", "Fires", "#ffd54f");
    drawChart("#chart-area-over-time", "area", "Area Burned (acres)", "#ff7043");
  });
}

function drawSection3_StateComparison(data) {
  const margin = { top: 10, right: 30, bottom: 20, left: 120 };
  const width = 500 - margin.left - margin.right;
  const height = 800 - margin.top - margin.bottom;

  // === Aggregate 2019–2023 data ===
  const stateAgg = data.map(d => {
    const relevantYears = d.variables.filter(v => v.year >= 2019 && v.year <= 2023);
    return {
      state: d.state,
      fires: d3.sum(relevantYears, v => v.fires),
      area: d3.sum(relevantYears, v => v.total_area)
    };
  });

  // === Initial sort alphabetically ===
  const initialOrder = [...stateAgg].sort((a, b) => d3.ascending(a.state, b.state));

  // === Scales (Y is shared) ===
  const y = d3.scaleBand()
    .domain(initialOrder.map(d => d.state))
    .range([0, height])
    .padding(0.2);

  const xFires = d3.scaleLinear()
    .domain([0, d3.max(stateAgg, d => d.fires)])
    .nice()
    .range([0, width]);

  const xArea = d3.scaleLinear()
    .domain([0, d3.max(stateAgg, d => d.area)])
    .nice()
    .range([0, width]);

  const tooltip = d3.select("#tooltip");

  const drawBarChart = (containerId, xScale, valueKey, label, color, sortKey) => {
    const svg = d3.select(containerId)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Axis
    const yAxis = svg.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .attr("fill", "#ccc")
      .style("font-size", "12px");

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .selectAll("text")
      .attr("fill", "#ccc");

    // Bars
    const bars = svg.selectAll("rect")
      .data(initialOrder, d => d.state)
      .enter()
      .append("rect")
      .attr("y", d => y(d.state))
      .attr("height", y.bandwidth())
      .attr("x", 0)
      .attr("width", d => xScale(d[valueKey]))
      .attr("fill", color)
      .on("mouseover", function (event, d) {
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip
          .html(`<strong>State:</strong> ${d.state}<br/><strong>${label}:</strong> ${Math.round(d[valueKey]).toLocaleString()}`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 40) + "px");
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 40) + "px");
      })
      .on("mouseout", () => tooltip.transition().duration(300).style("opacity", 0));
    
    // === Animate sort ===
    setTimeout(() => {
      const sortedByValue = [...stateAgg].sort((a, b) => b[sortKey] - a[sortKey]);
      y.domain(sortedByValue.map(d => d.state));

      svg.selectAll("rect")
        .transition()
        .duration(1000)
        .attr("y", d => y(d.state));

      svg.select("g")
        .transition()
        .duration(1000)
        .call(d3.axisLeft(y))
        .selectAll("text")
        .attr("fill", "#ccc")
        .style("font-size", "12px");
    }, sortKey === "fires" ? 1500 : 3000);
  };

  drawBarChart("#chart-fires-by-state", xFires, "fires", "Fires", "#ffd54f", "fires");
  drawBarChart("#chart-area-by-state", xArea, "area", "Area Burned (acres)", "#ff7043", "area");
}

function drawSection4_Map(data) {
  const width = 1000;
  const height = 600;

  const stateNarratives = {
    "Montana": "Montana recorded the highest number of wildfires from 2019 to 2023, with fire locations spread across the entire state.",
    "California": "California faces intense wildfires, largely driven by the urban-wildland interface and prolonged droughts. The most impacted areas are within national forests.",
    "Arizona": "Arizona experiences frequent wildfires, particularly in the central region due to the concentration of forests.",
    "Oregon": "Oregon is seeing an increase in forest fires due to climate change and dense vegetation. Large clusters on the map indicate multiple major wildfire events.",
    "Idaho": "Idaho’s mountainous terrain and dry summers contribute to its recurring wildfire activity.",
    "New Mexico": "New Mexico frequently experiences fast-spreading fires, fueled by arid conditions and strong winds. Two major zones consistently experience large wildfires."
  };

  const svg = d3.select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const gMap = svg.append("g");

  const projection = d3.geoAlbersUsa()
    .translate([width / 2, height / 2])
    .scale(1200);

  const path = d3.geoPath().projection(projection);
  const tooltip = d3.select("#tooltip");

  // === Sort state dropdown by total fires (2019–2023) ===
  const statesSorted = [...data]
  .map(d => {
    const fires = d.variables
      .filter(v => v.year >= 2019 && v.year <= 2023)
      .reduce((sum, v) => sum + v.fires, 0);
    return { state: d.state, totalFires: fires };
  })
  .sort((a, b) => b.totalFires - a.totalFires);

  const years = Array.from(new Set(data.flatMap(d => d.variables.map(v => v.year)))).sort();

  // === Scales ===
  const yearColor = d3.scaleSequential()
    .domain([2019, 2023])
    .interpolator(d3.interpolateOranges);

  const radiusScale = d3.scaleSqrt()
    .domain([1, d3.max(data.flatMap(d => d.fires.map(f => f.burned_area_acres)))])
    .range([0.01, 10]);

  // === Zoom Setup ===
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", (event) => {
      gMap.attr("transform", event.transform);
    });

  svg.call(zoom);

  // === Dropdowns ===
  const stateSelect = d3.select("#state-select");

  stateSelect
    .selectAll("option")
    .data(statesSorted)
    .enter()
    .append("option")
    .text(d => d.state)
    .attr("value", d => d.state)
    .property("selected", d => d.state === "Montana");

  d3.select("#year-select")
    .selectAll("option")
    .data(["All", ...years])
    .enter()
    .append("option")
    .text(d => d)
    .attr("value", d => d);

  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(us => {
    const geoStates = topojson.feature(us, us.objects.states);
    const stateMap = geoStates.features.reduce((acc, f) => {
      acc[f.properties.name] = f;
      return acc;
    }, {});

    gMap.append("g")
      .selectAll("path")
      .data(geoStates.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("fill", "#2a2a2a")
      .attr("stroke", "#444");

    // Initial draw
    updateMap("Montana", "All");

    d3.select("#state-select").on("change", function () {
      const state = this.value;
      const year = d3.select("#year-select").property("value");
      updateMap(state, year);
    });

    d3.select("#year-select").on("change", function () {
      const year = this.value;
      const state = d3.select("#state-select").property("value");
      updateMap(state, year);
    });

    function updateMap(selectedState, selectedYear) {
      const stateData = data.find(d => d.state === selectedState);
      if (!stateData) return;

      const stateFires = stateData.fires.filter(f =>
        selectedYear === "All" || f.year === +selectedYear
      );

      const points = gMap.selectAll("circle")
        .data(stateFires, d => `${d.fire_name}_${d.lat}_${d.lon}_${d.year}`)
        .join(
          enter => enter.append("circle")
            .attr("cx", d => projection([d.lon, d.lat])[0])
            .attr("cy", d => projection([d.lon, d.lat])[1])
            .attr("r", 0)
            .attr("fill", d => yearColor(d.year))
            .attr("fill-opacity", 0.8)
            .on("mouseover", function (event, d) {
              tooltip.transition().duration(200).style("opacity", 0.9);
              tooltip.html(`
                <strong>${d.fire_name}</strong><br/>
                Cause: ${d.cause}<br/>
                Year: ${d.year}<br/>
                Burned Area: ${d.burned_area_acres.toLocaleString()} acres
              `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 40) + "px");
            })
            .on("mouseout", () => tooltip.transition().duration(300).style("opacity", 0))
            .transition()
            .duration(600)
            .attr("r", d => radiusScale(d.burned_area_acres)),

          update => update
            .transition()
            .duration(600)
            .attr("r", d => radiusScale(d.burned_area_acres))
            .attr("fill", d => yearColor(d.year)),

          exit => exit
            .transition()
            .duration(300)
            .attr("r", 0)
            .remove()
        );

      // Zoom to selected state
      const selectedFeature = stateMap[selectedState];
      if (selectedFeature) {
        const [[x0, y0], [x1, y1]] = path.bounds(selectedFeature);
        const dx = x1 - x0;
        const dy = y1 - y0;
        const scale = Math.min(8, 0.9 / Math.max(dx / width, dy / height));
        const tx = width / 2 - scale * (x0 + dx / 2);
        const ty = height / 2 - scale * (y0 + dy / 2);

        svg.transition()
          .duration(1000)
          .call(
            zoom.transform,
            d3.zoomIdentity.translate(tx, ty).scale(scale)
          );
      }

      const narrativeBox = document.getElementById("state-narrative");
      if (stateNarratives[selectedState]) {
        narrativeBox.style.display = "block";
        narrativeBox.innerText = stateNarratives[selectedState];
      } else {
        narrativeBox.style.display = "none";
      }
    }
  });
}

function drawSection5_CausesBubble(data) {
  const width = 600;
  const height = 500;

  // === Aggregate causes ===
  const causeCounts = {};
  let totalFires = 0;

  data.forEach(d => {
    d.fires.forEach(fire => {
      if (fire.year >= 2019 && fire.year <= 2023) {
        const cause = fire.cause || "Unknown";
        causeCounts[cause] = (causeCounts[cause] || 0) + 1;
        totalFires++;
      }
    });
  });

  // === Top 9 causes only ===
  const topCauses = Object.entries(causeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 9)
    .map(([cause, count]) => ({
      cause,
      count,
      percentage: ((count / totalFires) * 100).toFixed(1)
    }));

  // === Bubble layout ===
  const pack = d3.pack()
    .size([width, height])
    .padding(10);

  const root = d3.hierarchy({ children: topCauses })
    .sum(d => d.count);

  const nodes = pack(root).leaves();

  const svg = d3.select("#chart-causes-bubble")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const color = d3.scaleOrdinal(d3.schemeOrRd[5]);
  const tooltip = d3.select("#tooltip");

  // Bubbles
  const circle = svg.selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", 0)
    .attr("fill", (d, i) => color(i))
    .attr("fill-opacity", 0.85)
    .on("mouseover", function (event, d) {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html(`
        <strong>${d.data.cause}</strong><br/>
        Fires: ${d.data.count.toLocaleString()}<br/>
        ${d.data.percentage}% of all fires
      `)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 40) + "px");
    })
    .on("mouseout", () => tooltip.transition().duration(300).style("opacity", 0));

  circle.transition()
    .duration(1000)
    .ease(d3.easeElasticOut.amplitude(1.3).period(0.4))
    .attr("r", d => d.r);

  // Labels
  svg.selectAll("text")
    .data(nodes)
    .join("text")
    .attr("x", d => d.x)
    .attr("y", d => d.y - 4)
    .attr("text-anchor", "middle")
    .attr("fill", "#fff")
    .attr("opacity", 0)
    .style("font-size", "12px")
    .text(d => d.data.cause.length > 12 ? d.data.cause.slice(0, 12) + "…" : d.data.cause)
    .transition()
    .delay(600)
    .duration(600)
    .attr("opacity", 1);

  svg.selectAll(".percent-label")
    .data(nodes)
    .join("text")
    .attr("class", "percent-label")
    .attr("x", d => d.x)
    .attr("y", d => d.y + 12)
    .attr("text-anchor", "middle")
    .attr("fill", "#f5f5f5")
    .attr("opacity", 0)
    .style("font-size", "11px")
    .text(d => `${d.data.percentage}%`)
    .transition()
    .delay(800)
    .duration(600)
    .attr("opacity", 1);
}

function drawSection5_Heatmap(data) {
  const margin = { top: 30, right: 10, bottom: 40, left: 50 };
  const width = 600 - margin.left - margin.right;
  const height = 250 - margin.top - margin.bottom;

  const svg = d3.select("#chart-heatmap")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const years = [2019, 2020, 2021, 2022, 2023];

  const x = d3.scaleBand().domain(months).range([0, width]).padding(0.05);
  const y = d3.scaleBand().domain(years).range([0, height]).padding(0.05);

  const colorScale = d3.scaleSequential()
    .interpolator(d3.interpolateOrRd)
    .domain([0, 100]);

  svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("fill", "#ccc");

  svg.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y))
    .selectAll("text")
    .attr("fill", "#ccc");

  const tooltip = d3.select("#tooltip");

  const selectedStates = [
    "California", "Arizona", "Oregon", "New Mexico", "Idaho", "Montana",
    "Colorado", "Washington", "Wyoming", "Alaska", "Utah"
  ];

  const filteredStates = data
    .filter(d => selectedStates.includes(d.state))
    .sort((a, b) => d3.descending(a.state, b.state));

  const dropdown = d3.select("#heatmap-state-select");

  dropdown.selectAll("option")
    .data(filteredStates)
    .enter()
    .append("option")
    .text(d => d.state)
    .attr("value", d => d.state)
    .property("selected", d => d.state === "Montana");

  dropdown.on("change", function () {
    const selectedState = this.value;
    updateHeatmap(selectedState);
  });

  updateHeatmap("Montana");

  function updateHeatmap(stateName) {
    const stateData = data.find(d => d.state === stateName);
    const monthCounts = [];

    for (const year of years) {
      for (let m = 1; m <= 12; m++) {
        const fires = stateData.fires.filter(f => {
          const date = new Date(f.start_datetime);
          return f.year === year && date.getMonth() + 1 === m;
        });
        monthCounts.push({
          year,
          month: months[m - 1],
          count: fires.length
        });
      }
    }

    colorScale.domain([0, d3.max(monthCounts, d => d.count)]);

    const rects = svg.selectAll("rect")
      .data(monthCounts, d => `${d.year}_${d.month}`);

    rects.enter()
      .append("rect")
      .attr("x", d => x(d.month))
      .attr("y", d => y(d.year))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", d => colorScale(d.count))
      .attr("fill-opacity", 0)
      .on("mouseover", function (event, d) {
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip.html(`
          <strong>${d.month} ${d.year}</strong><br/>
          Fires: ${d.count}
        `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 40) + "px");
      })
      .on("mouseout", () => tooltip.transition().duration(300).style("opacity", 0))
      .transition()
      .duration(600)
      .attr("fill-opacity", 1);

    rects.transition()
      .duration(600)
      .attr("fill", d => colorScale(d.count));

    rects.exit()
      .transition()
      .duration(300)
      .attr("fill-opacity", 0)
      .remove();
  }
}

function drawSection5_EnvironmentalScatter(data) {
  const margin = { top: 30, right: 30, bottom: 60, left: 70 };
  const width = 700 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const labelMap = {
    avg_humidity: "Humidity (%)",
    avg_temp: "Temperature (°C)",
    population: "Population",
    fires_2019_2023: "Log(Number of Fires)",
    burned_area_acres: "Log(Total Burned Area)"
  };

  const svg = d3.select("#chart-scatter-env")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const tooltip = d3.select("#tooltip");

  // === Aggregate data by state (2019–2023) ===
  const aggData = data.map(d => {
    const filtered = d.variables.filter(v => v.year >= 2019 && v.year <= 2023);
    const totalFires = d3.sum(filtered, v => v.fires);
    const totalArea = d3.sum(filtered, v => v.total_area);
    const avgTemp = d3.mean(filtered, v => v.avg_temp);
    const avgHumidity = d3.mean(filtered, v => v.avg_humidity);
    const avgPopulation = d3.mean(filtered, v => v.population);

    return {
      state: d.state,
      fires_2019_2023: Math.log10(totalFires + 1),
      burned_area_acres: Math.log10(totalArea + 1),
      avg_temp: avgTemp,
      avg_humidity: avgHumidity,
      population: avgPopulation
    };
  });

  let currentX = "avg_humidity";
  let currentY = "fires_2019_2023";

  const x = d3.scaleLinear().range([0, width]);
  const y = d3.scaleLinear().range([height, 0]);

  const xAxisGroup = svg.append("g").attr("transform", `translate(0, ${height})`);
  const yAxisGroup = svg.append("g");

  const xAxisLabel = svg.append("text")
    .attr("class", "x-axis-label")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 10)
    .attr("text-anchor", "middle")
    .attr("fill", "#ccc")
    .text(labelMap[currentX]);

  const yAxisLabel = svg.append("text")
    .attr("class", "y-axis-label")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 15)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#ccc")
    .text(labelMap[currentY]);

  const updateChart = () => {
    x.domain(d3.extent(aggData, d => d[currentX])).nice();
    y.domain(d3.extent(aggData, d => d[currentY])).nice();

    xAxisGroup.transition().duration(600).call(d3.axisBottom(x).ticks(6)).selectAll("text").attr("fill", "#ccc");
    yAxisGroup.transition().duration(600).call(d3.axisLeft(y).ticks(6)).selectAll("text").attr("fill", "#ccc");

    const circles = svg.selectAll("circle")
      .data(aggData, d => d.state);

    circles.join(
      enter => enter.append("circle")
        .attr("cx", d => x(d[currentX]))
        .attr("cy", d => y(d[currentY]))
        .attr("r", 0)
        .attr("fill", "#ff8a65")
        .attr("fill-opacity", 0.8)
        .on("mouseover", (event, d) => {
          tooltip.transition().duration(200).style("opacity", 0.9);
          tooltip.html(`
            <strong>${d.state}</strong><br/>
            ${currentX}: ${Math.round(d[currentX] * 10) / 10}<br/>
            ${currentY}: ${Math.round(d[currentY] * 100) / 100}
          `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 40) + "px");
        })
        .on("mouseout", () => tooltip.transition().duration(300).style("opacity", 0))
        .transition()
        .duration(800)
        .attr("r", 6),

      update => update
        .transition()
        .duration(800)
        .attr("cx", d => x(d[currentX]))
        .attr("cy", d => y(d[currentY])),

      exit => exit
        .transition()
        .duration(300)
        .attr("r", 0)
        .remove()
    );

    xAxisLabel.text(labelMap[currentX]);
    yAxisLabel.text(labelMap[currentY]);
  };

  // === Initialize dropdown interactions ===
  d3.select("#scatter-x-axis").on("change", function () {
    currentX = this.value;
    updateChart();
  });

  d3.select("#scatter-y-axis").on("change", function () {
    currentY = this.value;
    updateChart();
  });

  updateChart();
}

function drawSection6_Preparedness(data) {
  const width = 700, height = 400;
  const margin = { top: 30, right: 30, bottom: 60, left: 70 };

  const svg = d3.select("#chart-scatter-preparedness")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const plot = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().range([0, width - margin.left - margin.right]);
  const y = d3.scaleLinear().range([height - margin.top - margin.bottom, 0]);

  const tooltip = d3.select("#tooltip");

  const preparedData = data.map(d => {
    const fireVars = d.variables.filter(v => v.year >= 2019 && v.year <= 2023);
    const fireCount = d3.sum(fireVars, v => v.fires);
    const areaCount = d3.sum(fireVars, v => v.total_area);
    const avgFires = fireCount / fireVars.length;
    const stationCount = d.fire_station?.length || 0;
    return {
      state: d.state,
      fire_stations: stationCount,
      fires_2019_2023: avgFires,
      burned_area_acres: areaCount
    };
  });

  let currentY = "fires_2019_2023";

  const update = () => {
    x.domain([0, d3.max(preparedData, d => d.fire_stations)]).nice();
    y.domain([0, d3.max(preparedData, d => d[currentY])]).nice();

    plot.selectAll(".x-axis").remove();
    plot.selectAll(".y-axis").remove();
    plot.selectAll(".axis-label").remove();
    plot.selectAll(".annotation").remove();

    // Axes
    plot.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height - margin.top - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll("text").attr("fill", "#ccc");

    plot.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(y))
      .selectAll("text").attr("fill", "#ccc");

    // Labels
    plot.append("text")
      .attr("class", "axis-label")
      .attr("x", (width - margin.left - margin.right) / 2)
      .attr("y", height - margin.top - margin.bottom + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#ccc")
      .text("Number of Fire Stations");

    plot.append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -((height - margin.top - margin.bottom) / 2))
      .attr("y", -50)
      .attr("text-anchor", "middle")
      .attr("fill", "#ccc")
      .text(currentY === "fires_2019_2023" ? "Avg Annual Fires" : "Total Burned Area (Acres)");

    // Circles
    const circles = plot.selectAll("circle")
      .data(preparedData, d => d.state);

    circles.join(
      enter => enter.append("circle")
        .attr("cx", d => x(d.fire_stations))
        .attr("cy", d => y(d[currentY]))
        .attr("r", 0)
        .attr("fill", "#ff7043")
        .attr("fill-opacity", 0.8)
        .on("mouseover", (event, d) => {
          tooltip.transition().duration(200).style("opacity", 0.9);
          tooltip.html(`
            <strong>${d.state}</strong><br/>
            Fire Stations: ${d.fire_stations}<br/>
            ${currentY === "fires_2019_2023" ? "Avg Fires/Year" : "Total Burned Area"}: ${Math.round(d[currentY]).toLocaleString()}
          `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 40) + "px");
        })
        .on("mouseout", () => tooltip.transition().duration(300).style("opacity", 0))
        .transition().duration(600).attr("r", 6),

      update => update
        .transition()
        .duration(600)
        .attr("cx", d => x(d.fire_stations))
        .attr("cy", d => y(d[currentY])),

      exit => exit.transition().duration(300).attr("r", 0).remove()
    );

    // Annotations for CA and MT
    plot.selectAll(".annotation")
      .data(preparedData.filter(d => d.state === "California" || d.state === "Montana"))
      .enter()
      .append("text")
      .attr("class", "annotation")
      .attr("x", d => x(d.fire_stations) + 10)
      .attr("y", d => y(d[currentY]) - 10)
      .attr("fill", "#ffd54f")
      .attr("font-size", "12px")
      .text(d => d.state === "California" ? "Most fire stations" : "Low station count");
  };

  d3.select("#scatter-preparedness-y-axis").on("change", function () {
    currentY = this.value;
    update();
  });

  update();
}


// Running //

d3.json("data/fires_by_state.json").then(fireData => {
  globalFireData = fireData;
  drawSection1_TitleStackedBar(fireData);
});

// === Scrollama Setup ===
const scroller = scrollama();

function handleStepEnter(response) {
  const narrativeContent = document.getElementById("narrative-content");

  function updateNarrative(step) {
    const contentMap = {
      trends: "Fire frequency has dropped, but burned areas remain high. I would like to explore these diverging trends.",
      "state-comparison": `Wait a moment to see how each state ranks based on the number of wildfire occurrences and the total area burned between 2019 and 2023.
      <br>
      <br>
      From the bar chart on the left, Montana and California stand out with the highest number of wildfires. However, when it comes to the total area burned (the chart on the right), California is by far the most impacted state.
      `,
      map: `Zoom into fire locations across the U.S. Filter the state and year to see the distribution of fire locations 
      in each state.<br> <br> Each bubble indicates the location of fire, the size of bubble represents area burned, 
      and the color shows the year of occurence`,
      causes: `From the data, the most common cause of wildfires is lightning, followed by undetermined causes and human activities.
      <br>
      <br>
      Looking at the monthly wildfire occurrence pattern, we observe peak activity during the summer months. You can filter by state to explore trends for each of the top 11 states.
      <br>
      <br>
      For a more quantitative analysis, I created a scatter plot comparing wildfire occurrences against three factors: humidity (%), temperature (°C), and population.
      From the plot, there appears to be a slight negative correlation between the number of wildfires and humidity. 
      You can use the X-axis and Y-axis filters to explore relationships between different variables.
      `,
      preparedness: `The scatter plot comparing the average yearly number of wildfires with the number of fire and emergency response stations is used to assess each state's level of preparedness.
      <br>
      <br>
      From the plot, California stands out with the highest number of fire stations, suggesting a strong capacity for wildfire response. In contrast, Montana experiences a high number of wildfires but has fewer fire stations 
      than several other states with far fewer wildfire incidents.
      `
    };

    narrativeContent.innerHTML = `<p>${contentMap[step] || ""}</p>`;
  }

  const step = response.element.getAttribute("data-step");

  d3.selectAll(".step").classed("active", (d, i, nodes) => nodes[i] === response.element);

  updateNarrative(step);

  const narrativeBox = document.getElementById("narrative-box");
  if (step === "title" || step === 'outro') {
    narrativeBox.style.display = "none";
  } else if (window.innerWidth > 900) {
    narrativeBox.style.display = "block";
  }

  if (step === "trends" && !handleStepEnter.trendsDrawn) {
    drawSection2_LineChartsAnimated();
    handleStepEnter.trendsDrawn = true;
  }

  if (step === "state-comparison" && !handleStepEnter.stateChartDrawn) {
    drawSection3_StateComparison(globalFireData);
    handleStepEnter.stateChartDrawn = true;
  }

  if (step === "map" && !handleStepEnter.mapDrawn) {
    drawSection4_Map(globalFireData);
    handleStepEnter.mapDrawn = true;
  }

  if (step === "causes" && !handleStepEnter.causesDrawn) {
    drawSection5_CausesBubble(globalFireData);
    drawSection5_Heatmap(globalFireData);
    drawSection5_EnvironmentalScatter(globalFireData);
    handleStepEnter.causesDrawn = true;
  }

  if (step === "preparedness" && !handleStepEnter.preparednessDrawn) {
    drawSection6_Preparedness(globalFireData);
    handleStepEnter.preparednessDrawn = true;
  } 

  if (step === "outro" && !handleStepEnter.outroShown) {
    console.log("Outro section visible!");
    handleStepEnter.outroShown = true;
  }
  
}


scroller
  .setup({
    step: ".step",
    offset: 0.6,
    debug: false
  })
  .onStepEnter(handleStepEnter);

// re-calculate on resize
// window.addEventListener("resize", scroller.resize);

// === Back to Top Button Logic ===
const topBtn = document.getElementById("backToTop");

window.onscroll = () => {
  topBtn.style.opacity = window.scrollY > 300 ? 1 : 0;
};

topBtn.onclick = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};
