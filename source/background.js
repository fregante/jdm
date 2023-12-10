import easyIcon from 'url:./icons/easy.png';
import mediumIcon from 'url:./icons/medium.png';
import hardIcon from 'url:./icons/hard.png';
import impossibleIcon from 'url:./icons/impossible.png';

/**
 * @typedef {'easy' | 'medium' | 'hard' | 'impossible'} Difficulty
 * @typedef {{name: string, url?: string, domains: string[], notes?: string, difficulty: Difficulty}} Site
 */

function chunkArray(array, size) {
	const result = [];
	for (let i = 0; i < array.length; i += size) {
		result.push(array.slice(i, i + size));
	}

	return result;
}

/** @type {Object.<Difficulty, ImageData>} */
const icons = {};

// Chrome won't accept `path` as a URL in SetIcon, so we have to do this...
async function loadImageData(url) {
	const response = await fetch(url);
	const blob = await response.blob();
	const image = await createImageBitmap(blob);
	const canvas = new OffscreenCanvas(image.width, image.height);
	const canvasContext = canvas.getContext('2d');
	canvasContext.clearRect(0, 0, canvas.width, canvas.height);
	canvasContext.drawImage(image, 0, 0, canvas.width, canvas.height);
	return canvasContext.getImageData(0, 0, canvas.width, canvas.height);
}

async function updateRules() {
	const response = await fetch('https://raw.githubusercontent.com/jdm-contrib/jdm/master/_data/sites.json');

	icons.easy = await loadImageData(easyIcon);
	icons.medium = await loadImageData(mediumIcon);
	icons.hard = await loadImageData(hardIcon);
	icons.impossible = await loadImageData(impossibleIcon);

	/** @type {Site[]} */
	const sites = await response.json();

	console.log('Found', sites.length, 'sites');

	const validSites = sites.filter(site => site.domains.length > 0 && site.difficulty in icons);
	console.log('Found', sites.length, 'valid sites');

	/** @type {chrome.events.Rule[]} */
	const rules = validSites.map(site => ({
		conditions: site.domains.map(domain => new chrome.declarativeContent.PageStateMatcher({
			pageUrl: {hostSuffix: domain.toLowerCase()},
		})),
		actions: [
			new chrome.declarativeContent.ShowAction(),
			new chrome.declarativeContent.SetIcon({
				imageData: icons[site.difficulty],
			}),
		],
	}));

	await chrome.declarativeContent.onPageChanged.removeRules();

	// Try not to fail the entire extension of one site is invalid
	// Don't call addRules too many times or else it will slow down the browser
	chunkArray(rules, 180).map(async (chunk, i, {length}) => {
		console.log('Adding chunk', i + 1, 'of', length);
		await chrome.declarativeContent.onPageChanged.addRules(chunk);
	});
}

chrome.runtime.onInstalled.addListener(updateRules);
chrome.alarms.create('daily-update', {periodInMinutes: 60 * 24});
chrome.alarms.onAlarm.addListener(updateRules);

chrome.action.onClicked.addListener(tab => {
	console.log('Clicked on', tab);
	const url = new URL('https://justdeleteme.xyz/');
	if (tab.url.startsWith('http')) {
		const currentUrl = new URL(tab.url);
		url.hash = currentUrl.host;
	}

	chrome.tabs.create({url: url.href, openerTabId: tab.id});
});
