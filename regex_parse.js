const regexInputBox = document.getElementById("inputted_regex")
const regexOutput = document.getElementById("highlighted_regex")

regexInputBox.addEventListener("input", () => {
	regexOutput.textContent = regexInputBox.value;
})
