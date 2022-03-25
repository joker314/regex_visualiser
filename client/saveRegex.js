const saveButton = document.querySelector("#save_regex")
const saveMessage = document.querySelector("#save_message")

const inputRegexBox = document.querySelector("#inputted_regex")
const testWordBox = document.querySelector("#test_word")

/**
 * Function which attempts to extract the error from a JSON response,
 * but which doesn't crash if the response text is malformed and so
 * not actually JSON
 */
function extractError (responseText) {
	let errorMessage = "(malformed response from server)"
	
	try {
		errorMessage = JSON.parse(responseText).error
	} catch (error) {
		// The fallback errorMessage will be used, so we can ignore the error
		// since it's already been handled in that way
		console.error(error)
	}
}

saveButton.addEventListener("click", () => {
	const saveRequest = new XMLHttpRequest()
	const regexID = parseInt(saveButton.dataset.regexId)
	const encodedRegex = encodeURIComponent(inputRegexBox.value)
	const encodedSampleInput = encodeURIComponent(testWordBox.value)
	
	if (regexID === 0) {
		saveRequest.open("POST", "/api/regex/add")
		saveRequest.setRequestHeader("Content-type", "application/x-www-form-urlencoded")
		
		saveRequest.onreadystatechange = () => {
			if (saveRequest.readyState === 4) {
				if (saveRequest.status === 200) {
					const {id} = JSON.parse(saveRequest.responseText)
					saveMessage.textContent = "Saved successfully. Press 'Save' again later to overwrite with your newer changes"
					saveButton.dataset.regexId = id
				} else {
					saveMessage.textContent = "Error while saving: " + extractError(saveRequest.responseText)
				}
			}
		}
		
		saveRequest.send("regex=" + encodedRegex + "&sample_input=" + encodedSampleInput)
	} else {
		saveRequest.open("POST", "/api/regex/edit")
		saveRequest.setRequestHeader("Content-type", "application/x-www-form-urlencoded")
		
		saveRequest.onreadystatechange = () => {
			if (saveRequest.readyState === 4) {
				if (saveRequest.status === 200) {
					saveMessage.textContent = "Last saved at " + (new Date)
				} else {
					saveMessage.textContent = "Error while saving: " + extractError(saveRequest.responseText)
				}
			}
		}
		
		saveRequest.send("regex_id=" + regexID + "&regex=" + encodedRegex + "&sample_input=" + encodedSampleInput)
	}
})