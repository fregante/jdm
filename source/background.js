import easyIcon from 'url:./icons/easy.png';
import mediumIcon from 'url:./icons/medium.png';
import hardIcon from 'url:./icons/hard.png';
import impossibleIcon from 'url:./icons/impossible.png';

const icons = {};

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

/**
 * @typedef {'easy' | 'medium' | 'hard' | 'impossible'} Difficulty
 * @typedef {{name: string, url?: string, domains: string[], notes?: string, difficulty: Difficulty}} Site
 */

async function updateRules() {
	const response = await fetch('https://raw.githubusercontent.com/jdm-contrib/jdm/master/_data/sites.json');

	icons.easy = await loadImageData(easyIcon);
	icons.medium = await loadImageData(mediumIcon);
	icons.hard = await loadImageData(hardIcon);
	icons.impossible = await loadImageData(impossibleIcon);

	/** @type {Site[]} */
	const sites = await response.json();

	await chrome.action.disable();
	await chrome.declarativeContent.onPageChanged.removeRules(undefined);

	await Promise.all(sites.map(async site => {
		if (!(site.domains.length > 0 && site.difficulty in icons)) {
			return;
		}

		await chrome.declarativeContent.onPageChanged.addRules([{
			conditions: site.domains.map(domain => new chrome.declarativeContent.PageStateMatcher({
				pageUrl: {hostSuffix: domain.toLowerCase()},
			})),
			actions: [
				new chrome.declarativeContent.ShowAction(),
				new chrome.declarativeContent.SetIcon({
					imageData: icons[site.difficulty],
				}),
			],
		}]);
	}));
}

chrome.runtime.onInstalled.addListener(updateRules);
chrome.alarms.create('daily-update', {periodInMinutes: 60 * 24});
